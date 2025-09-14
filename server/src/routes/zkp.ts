import { Router } from 'express'
import { z } from 'zod'
import { createProofRequest, ProofSchema, verifyProof, isProofAlreadyVerified, createSteamProof, verifySteamProof } from '../reclaim.js'
import { prisma } from '../db.js'
import { createRateLimiter } from '../middleware/rateLimiter.js'

export const zkpRouter = Router()

// Rate limiters for different endpoints
const requestLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // 5 requests per minute
  message: 'Too many proof requests, please try again later'
})

const verifyLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 verifications per minute
  message: 'Too many verification attempts, please try again later'
})

// Schema for Steam proof request
const SteamProofRequestSchema = z.object({
  steamId: z.string(),
  userDataUrl: z.string().url(),
  cookieStr: z.string(),
  targetAppId: z.string().optional()
})

// Schema for Steam proof verification
const SteamProofVerifySchema = z.object({
  proof: z.any(),
  steamId: z.string(),
  // The app the user claims to own (e.g., source game)
  targetAppId: z.string().optional(),
  // Also accept an alternative app id (e.g., recommended game)
  recommendedAppId: z.string().optional(),
  // If provided, proofs will be stored under this account
  walletAddress: z.string().optional(),
})

zkpRouter.post("/request", requestLimiter, async (req, res) => {
  try {
    const { providerId } = (req.body || {}) as { providerId?: string };
    const r = await createProofRequest({ providerId });

    // Persist a pending proof linked to this session
    try {
      const humanType = await prisma.accountType.findFirst({
        where: { name: "human" },
      });
      const account = await prisma.account.upsert({
        where: { walletAddress: `zkp:${r.sessionId}` },
        update: {},
        create: {
          walletAddress: `zkp:${r.sessionId}`,
          nickname: "ZKP Session",
          accountTypeId: humanType
            ? humanType.id
            : (await prisma.accountType.findFirst()).id,
        },
      });

      // Prefer SteamOwnership if present, otherwise Generic
      let pt = await prisma.proofType.findFirst({
        where: { name: "SteamOwnership" },
      });
      if (!pt) {
        pt = await prisma.proofType.upsert({
          where: { name: "Generic" },
          update: {},
          create: { name: "Generic", description: "Generic ZKP proof type" },
        });
      }

      await prisma.proof.upsert({
        where: { sessionId: r.sessionId },
        update: {
          userId: account.id,
          proofTypeId: pt.id,
          provider: providerId || "steam",
          status: "pending",
          proofData: { request: r },
        },
        create: {
          userId: account.id,
          proofTypeId: pt.id,
          provider: providerId || "steam",
          status: "pending",
          proofData: { request: r },
          sessionId: r.sessionId,
        },
      });
    } catch (persistErr) {
      console.warn("[ZKP] Failed to persist pending proof:", persistErr);
    }

    res.json(r);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "failed" });
  }
});

zkpRouter.post("/verify", verifyLimiter, async (req, res) => {
  const parse = ProofSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      error: "Invalid proof format",
      details: parse.error.flatten(),
    });
  }

  try {
    // Check for duplicate proof if sessionId is provided
    if (parse.data.sessionId) {
      const isDuplicate = await isProofAlreadyVerified(
        parse.data.sessionId,
        async (sessionId) => prisma.proof.findUnique({ where: { sessionId } })
      );

      if (isDuplicate) {
        console.log(
          `[ZKP] Duplicate proof attempt for session: ${parse.data.sessionId}`
        );
        return res.status(409).json({
          error: "Proof already verified",
          sessionId: parse.data.sessionId,
        });
      }
    }

    // Verify the proof
    const result = await verifyProof(parse.data);

    // Persist proof outcome (verified or not) using current schema
    // Resolve Account (create a pseudo account if needed)
    const steamId = (parse.data as any)?.payload?.steamId as string | undefined;
    const sessionId =
      parse.data.sessionId || "session-" + Math.random().toString(36).slice(2);
    const walletAddress = steamId ? `steam:${steamId}` : `zkp:${sessionId}`;

    // Pick an account type (human if exists)
    const humanType = await prisma.accountType.findFirst({
      where: { name: "human" },
    });
    const account = await prisma.account.upsert({
      where: { walletAddress },
      update: {},
      create: {
        walletAddress,
        nickname: steamId ? `Steam ${steamId}` : "ZKP User",
        accountTypeId: humanType
          ? humanType.id
          : (await prisma.accountType.findFirst()).id,
      },
    });

    // Resolve proof type
    const proofTypeName =
      parse.data.provider?.toLowerCase() === "steam"
        ? "SteamOwnership"
        : "Generic";
    let proofType = await prisma.proofType.findFirst({
      where: { name: proofTypeName },
    });
    if (!proofType) {
      proofType = await prisma.proofType.create({
        data: {
          name: proofTypeName,
          description: `${parse.data.provider || "generic"} proof`,
        },
      });
    }

    // Store proof with sessionId for duplicate prevention (upsert on sessionId)
    await prisma.proof.upsert({
      where: { sessionId },
      update: {
        userId: account.id,
        proofTypeId: proofType.id,
        title: `${parse.data.provider || "proof"} verification`,
        description: result.verified ? "Verified" : `Failed: ${result.reason}`,
        provider: parse.data.provider,
        proofData: parse.data.payload,
        status: result.verified ? "verified" : "rejected",
      },
      create: {
        userId: account.id,
        proofTypeId: proofType.id,
        title: `${parse.data.provider || "proof"} verification`,
        description: result.verified ? "Verified" : `Failed: ${result.reason}`,
        provider: parse.data.provider,
        proofData: parse.data.payload,
        status: result.verified ? "verified" : "rejected",
        sessionId,
      },
    });

    if (result.verified) {
      console.log(`[ZKP] Proof stored for account: ${account.walletAddress}`);
    } else {
      console.warn(`[ZKP] Proof stored with failed status: ${result.reason}`);
    }

    res.json(result);
  } catch (e: any) {
    console.error("[ZKP] Verification error:", e);

    // Check for unique constraint violation (duplicate sessionId)
    if (e.code === "P2002" && e.meta?.target?.includes("sessionId")) {
      return res.status(409).json({
        error: "Proof already verified",
        sessionId: parse.data.sessionId,
      });
    }

    res.status(500).json({
      error: "Verification failed",
      message: e?.message || "Internal server error",
    });
  }
});

// Test helper: inserts a mock proof row
zkpRouter.post("/test/mock", async (_req, res) => {
  const humanType = await prisma.accountType.findFirst({
    where: { name: "human" },
  });
  const acc = await prisma.account.upsert({
    where: { walletAddress: "steam:TEST" },
    update: {},
    create: {
      walletAddress: "steam:TEST",
      accountTypeId: humanType
        ? humanType.id
        : (await prisma.accountType.findFirst()).id,
    },
  });
  const pt = await prisma.proofType.upsert({
    where: { name: "SteamOwnership" },
    update: {},
    create: { name: "SteamOwnership" },
  });
  const p = await prisma.proof.create({
    data: {
      userId: acc.id,
      proofTypeId: pt.id,
      provider: "steam",
      status: "verified",
      proofData: { mock: true, inserted: true },
    },
  });
  res.json({ ok: true, proofId: p.id });
});

// Steam-specific endpoints with rate limiting
zkpRouter.post("/steam/proof", requestLimiter, async (req, res) => {
  const parse = SteamProofRequestSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      success: false,
      error: "Invalid request parameters",
      details: parse.error.issues,
    });
  }

  try {
    console.log("Creating Steam proof for:", parse.data.steamId);
    const result = await createSteamProof(parse.data);

    // Store proof request in database (optional)
    if (!process.env.ZKP_MOCK || process.env.ZKP_MOCK === "false") {
      const humanType = await prisma.accountType.findFirst({
        where: { name: "human" },
      });
      const account = await prisma.account.upsert({
        where: { walletAddress: `steam:${parse.data.steamId}` },
        update: {},
        create: {
          walletAddress: `steam:${parse.data.steamId}`,
          accountTypeId: humanType
            ? humanType.id
            : (await prisma.accountType.findFirst()).id,
        },
      });
      console.log(
        `Proof created for account ${account.id} (steam:${parse.data.steamId})`
      );
    }

    res.json(result);
  } catch (error: any) {
    console.error("Steam proof creation failed:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create proof",
    });
  }
});

zkpRouter.post("/steam/verify", verifyLimiter, async (req, res) => {
  const parse = SteamProofVerifySchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      success: false,
      error: "Invalid verification parameters",
      details: parse.error.issues,
    });
  }

  try {
    console.log("Verifying Steam proof for:", parse.data.steamId);
    const result = await verifySteamProof(parse.data.proof);

    if (result.verified) {
      // Store verified proof in database
      const humanType = await prisma.accountType.findFirst({
        where: { name: "human" },
      });
      const walletForStorage = parse.data.walletAddress && parse.data.walletAddress.trim().length > 0
        ? parse.data.walletAddress
        : `steam:${parse.data.steamId}`;
      const account = await prisma.account.upsert({
        where: { walletAddress: walletForStorage },
        update: {},
        create: {
          walletAddress: walletForStorage,
          accountTypeId: humanType
            ? humanType.id
            : (await prisma.accountType.findFirst()).id,
        },
      });

      const pt = await prisma.proofType.upsert({
        where: { name: "SteamOwnership" },
        update: {},
        create: { name: "SteamOwnership" },
      });

      const steamSessionId = (result as any)?.sessionId as string | undefined;

      // Determine the verified targetAppId from the proof/result, not from client claim
      const proofTargetAppId = (parse.data.proof && (parse.data.proof as any).targetAppId) || (result as any)?.targetAppId;

      // Accept if proof's targetAppId matches either claimed targetAppId or recommendedAppId
      const claimedA = parse.data.targetAppId ? String(parse.data.targetAppId) : undefined;
      const claimedB = parse.data.recommendedAppId ? String(parse.data.recommendedAppId) : undefined;
      const inProof = proofTargetAppId ? String(proofTargetAppId) : undefined;

      const hasClaims = !!(claimedA || claimedB);
      const matchesEither = inProof && (inProof === claimedA || inProof === claimedB);

      if (inProof && hasClaims && !matchesEither) {
        return res.status(400).json({
          success: false,
          error: 'target-app-id-mismatch',
          details: {
            claimedTargetAppId: claimedA,
            claimedRecommendedAppId: claimedB,
            inProof,
          },
        });
      }

      // Normalize proof payload for downstream purchase-history checks
      // games.ts expects proofData.appId to match Steam app id confirmed by proof
      const normalizedProofData: any = {
        steamId: parse.data.steamId,
        // prefer the ID embedded in proof; otherwise pick the one that matches
        appId: proofTargetAppId || claimedA || claimedB,
      };
      // Keep raw proof for auditing/debugging
      normalizedProofData.proof = parse.data.proof;
      if (steamSessionId) {
        await prisma.proof.upsert({
          where: { sessionId: steamSessionId },
          update: {
            userId: account.id,
            proofTypeId: pt.id,
            provider: "steam",
            status: "verified",
            proofData: normalizedProofData,
          },
          create: {
            userId: account.id,
            proofTypeId: pt.id,
            provider: "steam",
            status: "verified",
            proofData: normalizedProofData,
            sessionId: steamSessionId,
          },
        });
      } else {
        await prisma.proof.create({
          data: {
            userId: account.id,
            proofTypeId: pt.id,
            provider: "steam",
            status: "verified",
            proofData: normalizedProofData,
          },
        });
      }

      console.log(`Proof verified and stored for account ${account.id}`);
    }

    res.json({
      success: result.verified,
      ...result,
    });
  } catch (error: any) {
    console.error("Steam proof verification failed:", error);

    // Check for duplicate proof
    if (error.code === "P2002" && error.meta?.target?.includes("sessionId")) {
      return res.status(409).json({
        success: false,
        error: "Proof already verified",
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || "Failed to verify proof",
    });
  }
});
