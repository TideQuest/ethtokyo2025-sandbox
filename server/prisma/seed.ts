/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('[seed] Starting seed...')

  // Create AccountTypes
  const accountTypes = await Promise.all([
    prisma.accountType.upsert({
      where: { name: 'human' },
      update: {},
      create: {
        name: 'human',
        description: 'Human user account',
      },
    }),
    prisma.accountType.upsert({
      where: { name: 'ai' },
      update: {},
      create: {
        name: 'ai',
        description: 'AI agent account',
      },
    }),
    prisma.accountType.upsert({
      where: { name: 'admin' },
      update: {},
      create: {
        name: 'admin',
        description: 'Administrator account',
      },
    }),
  ])

  console.log('[seed] Account types created:', accountTypes.length)

  // Create ProofTypes
  const proofTypes = await Promise.all([
    prisma.proofType.upsert({
      where: { name: 'SteamOwnership' },
      update: {},
      create: {
        name: 'SteamOwnership',
        description: 'Proof of Steam game ownership',
        formatSchema: {
          type: 'object',
          properties: {
            steamId: { type: 'string' },
            appId: { type: 'string' },
            playtime: { type: 'number' },
          },
        },
      },
    }),
    prisma.proofType.upsert({
      where: { name: 'SteamAchievement' },
      update: {},
      create: {
        name: 'SteamAchievement',
        description: 'Steam achievement verification',
        formatSchema: {
          type: 'object',
          properties: {
            steamId: { type: 'string' },
            appId: { type: 'string' },
            achievementId: { type: 'string' },
          },
        },
      },
    }),
  ])

  console.log('[seed] Proof types created:', proofTypes.length)

  // Create ItemTypes
  const itemType = await prisma.itemType.upsert({
    where: { name: 'SteamGame' },
    update: {},
    create: {
      name: 'SteamGame',
      description: 'Steam game item',
      schema: {
        type: 'object',
        properties: {
          appId: { type: 'string' },
          name: { type: 'string' },
          storeUrl: { type: 'string' },
        },
      },
    },
  })

  console.log('[seed] Item type created:', itemType.name)

  // Create Sample Accounts
  const accounts = await Promise.all([
    prisma.account.upsert({
      where: { walletAddress: '0x1234567890123456789012345678901234567890' },
      update: {},
      create: {
        walletAddress: '0x1234567890123456789012345678901234567890',
        nickname: 'SamplePlayer1',
        description: 'Loves farming and casual games',
        accountTypeId: accountTypes[0].id, // human
      },
    }),
    prisma.account.upsert({
      where: { walletAddress: '0x2345678901234567890123456789012345678901' },
      update: {},
      create: {
        walletAddress: '0x2345678901234567890123456789012345678901',
        nickname: 'SamplePlayer2',
        description: 'VR enthusiast and rhythm game lover',
        accountTypeId: accountTypes[0].id, // human
      },
    }),
    prisma.account.upsert({
      where: { walletAddress: '0x3456789012345678901234567890123456789012' },
      update: {},
      create: {
        walletAddress: '0x3456789012345678901234567890123456789012',
        nickname: 'HardcoreGamer',
        description: 'Enjoys challenging games and Souls-like titles',
        accountTypeId: accountTypes[0].id, // human
      },
    }),
    prisma.account.upsert({
      where: { walletAddress: '0x4567890123456789012345678901234567890123' },
      update: {},
      create: {
        walletAddress: '0x4567890123456789012345678901234567890123',
        nickname: 'TideQuestAI',
        description: 'AI recommendation agent for personalized game suggestions',
        accountTypeId: accountTypes[1].id, // ai
      },
    }),
    prisma.account.upsert({
      where: { walletAddress: '0x5678901234567890123456789012345678901234' },
      update: {},
      create: {
        walletAddress: '0x5678901234567890123456789012345678901234',
        nickname: 'SystemAdmin',
        description: 'System administrator account',
        accountTypeId: accountTypes[2].id, // admin
      },
    }),
  ])

  console.log('[seed] Sample accounts created:', accounts.length)

  // Create Steam Games from the Discord data
  const gamesData = [
    // Standard games
    { appId: '413150', name: 'Stardew Valley', storeUrl: 'https://store.steampowered.com/app/413150/Stardew_Valley/' },
    { appId: '1290000', name: 'PowerWash Simulator', storeUrl: 'https://store.steampowered.com/app/1290000/PowerWash_Simulator/' },
    { appId: '1868140', name: 'DAVE THE DIVER', storeUrl: 'https://store.steampowered.com/app/1868140/DAVE_THE_DIVER/' },
    { appId: '1245620', name: 'ELDEN RING', storeUrl: 'https://store.steampowered.com/app/1245620/ELDEN_RING/' },
    { appId: '268910', name: 'Cuphead', storeUrl: 'https://store.steampowered.com/app/268910/Cuphead/' },
    // VR games
    { appId: '620980', name: 'Beat Saber', storeUrl: 'https://store.steampowered.com/app/620980/Beat_Saber/' },
    { appId: '1575520', name: 'Fruit Ninja VR 2', storeUrl: 'https://store.steampowered.com/app/1575520/Fruit_Ninja_VR_2/' },
    { appId: '617830', name: 'SUPERHOT VR', storeUrl: 'https://store.steampowered.com/app/617830/SUPERHOT_VR/' },
    { appId: '690620', name: 'Downward Spiral: Horus Station', storeUrl: 'https://store.steampowered.com/app/690620/Downward_Spiral_Horus_Station/' },
    { appId: '448280', name: 'Job Simulator', storeUrl: 'https://store.steampowered.com/app/448280/Job_Simulator/' },
    { appId: '450390', name: 'The Lab', storeUrl: 'https://store.steampowered.com/app/450390/The_Lab/' },
  ]

  const games = await Promise.all(
    gamesData.map(async (game) => {
      const item = await prisma.item.create({
        data: {
          itemTypeId: itemType.id,
          name: game.name,
          metadata: {
            appId: game.appId,
            storeUrl: game.storeUrl,
          },
        },
      })

      await prisma.itemSteamGame.create({
        data: {
          steamAppId: game.appId,
          itemId: item.id,
          gameName: game.name,
          storeUrl: game.storeUrl,
        },
      })

      return item
    })
  )

  console.log('[seed] Games created:', games.length)

  // Create Recommendation Combinations
  const recommendations = [
    // Combination 1: Stardew Valley → PowerWash Simulator
    {
      sourceGame: 'Stardew Valley',
      targetGame: 'PowerWash Simulator',
      recommender: accounts[0],
      text: 'Stardew Valleyで畑を耕し牧場が整っていくのをみて癒やされた体験を持つプレイヤーなら、ジャンルは違いますが、高圧洗浄機でひたすら汚れを落としていくPowerWash Simulatorは、「無心で作業し綺麗になっていく達成感」という点は同様の癒やしを提供してくれます。コツコツ作業して満足感を得たいというユーザーにおススメです。',
      rating: 4.5,
    },
    // Combination 2: Stardew Valley → DAVE THE DIVER
    {
      sourceGame: 'Stardew Valley',
      targetGame: 'DAVE THE DIVER',
      recommender: accounts[0],
      text: 'DAVE THE DIVERは、資源を集めてお店をアップグレードする、また資源を集める…というサイクルがStardew Valleyの食物を育ててスプリンクラーを設置して…また食物を育ててというサイクルと同じです。さらに無料体験版があるので気軽に試せます。',
      rating: 4.7,
    },
    // Combination 3: ELDEN RING → Cuphead
    {
      sourceGame: 'ELDEN RING',
      targetGame: 'Cuphead',
      recommender: accounts[2],
      text: '何度も挑戦するなかでプレイスキルが向上し、攻略法が思いつく…ついに難敵を乗り越える達成感。いわゆる「死にゲー」が好きなら、Cupheadも気に入るはずです。ダークな世界観とは反対の、レトロカートゥーンのようなポップなビジュアルで、「高難易度ボス戦の緊張感と達成感」だけを味わうことができます。',
      rating: 4.8,
    },
    // VR Combination 1: Beat Saber → Fruit Ninja VR 2
    {
      sourceGame: 'Beat Saber',
      targetGame: 'Fruit Ninja VR 2',
      recommender: accounts[1],
      text: 'Beat Saberはリズムゲームとしての刀操作がありその爽快感が人気の理由。刀操作に関して、Fruit NinjaはObjectの斬撃判定の精度が非常に高く、切れ味の表現等が細かく没入感が高いです。リズム爽快感に対して、切断そのものの爽快感を楽しめます。',
      rating: 4.6,
    },
    // VR Combination 2: SUPERHOT VR → Horus Station
    {
      sourceGame: 'SUPERHOT VR',
      targetGame: 'Downward Spiral: Horus Station',
      recommender: accounts[1],
      text: 'SUPERHOTの「動けば時間が動く」という仕様による緊張感＋ガンアクションの楽しさが人気の理由。このゆっくりガンアクションに慣れた上で、もう少しいろんなステージとか操作をしたい時に、Horus Stationの無重力下での操作が相性良くてウケがいいです。',
      rating: 4.3,
    },
    // VR Combination 3: Job Simulator → The Lab
    {
      sourceGame: 'Job Simulator',
      targetGame: 'The Lab',
      recommender: accounts[1],
      text: 'Job Simulatorは基本的なVR操作のチュートリアル的なゲームですが、The Labはさらにその拡張として武器が増えていて、多様なVR体験を楽しめます。',
      rating: 4.4,
    },
    // AI-generated recommendation
    {
      sourceGame: 'Beat Saber',
      targetGame: 'SUPERHOT VR',
      recommender: accounts[3], // AI account
      text: 'Both games excel in making players feel powerful through precise, deliberate movements. While Beat Saber focuses on rhythm and flow, SUPERHOT VR emphasizes tactical time manipulation. Players who enjoy the physical engagement and satisfying feedback of Beat Saber will appreciate SUPERHOT VR\'s unique time-control mechanic.',
      rating: 4.2,
    },
  ]

  // Create recommendation results
  for (const rec of recommendations) {
    const sourceItem = games.find((g) => g.name === rec.sourceGame)
    const targetItem = games.find((g) => g.name === rec.targetGame)

    if (sourceItem && targetItem) {
      // Create a recommendation request (optional)
      const request = await prisma.recommendRequest.create({
        data: {
          itemId: sourceItem.id,
          requesterAccountId: accounts[0].id,
          status: 'completed',
          requestDetails: `Looking for games similar to ${rec.sourceGame}`,
        },
      })

      // Create the recommendation result
      await prisma.recommendResult.create({
        data: {
          itemId: targetItem.id,
          recommendRequestId: request.id,
          recommenderAccountId: rec.recommender.id,
          recommendationText: rec.text,
          rating: rec.rating,
          recommendationData: {
            sourceGameId: sourceItem.id,
            sourceGameName: rec.sourceGame,
            targetGameName: rec.targetGame,
          },
          status: 'active',
        },
      })
    }
  }

  console.log('[seed] Recommendations created')

  // Create some sample proofs for accounts
  const sampleProofs = [
    {
      userId: accounts[0].id,
      proofTypeId: proofTypes[0].id,
      title: 'Stardew Valley Ownership',
      description: 'Owned Stardew Valley with 100+ hours playtime',
      provider: 'steam',
      proofData: {
        steamId: '76561198000000001',
        appId: '413150',
        playtime: 6000, // minutes
      },
      status: 'verified',
    },
    {
      userId: accounts[1].id,
      proofTypeId: proofTypes[0].id,
      title: 'Beat Saber Ownership',
      description: 'Owned Beat Saber',
      provider: 'steam',
      proofData: {
        steamId: '76561198000000002',
        appId: '620980',
        playtime: 3000,
      },
      status: 'verified',
    },
    {
      userId: accounts[2].id,
      proofTypeId: proofTypes[0].id,
      title: 'ELDEN RING Ownership',
      description: 'Owned ELDEN RING with significant playtime',
      provider: 'steam',
      proofData: {
        steamId: '76561198000000003',
        appId: '1245620',
        playtime: 12000,
      },
      status: 'verified',
    },
  ]

  await Promise.all(
    sampleProofs.map((proof) => prisma.proof.create({ data: proof }))
  )

  console.log('[seed] Sample proofs created')

  console.log('[seed] Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

