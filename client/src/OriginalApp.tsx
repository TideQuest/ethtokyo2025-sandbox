import { useState, useMemo } from 'react'
import QRCode from 'qrcode'
import { WalletProvider, WalletConnectControls } from './wallet'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

function useQr(data?: string) {
  const [url, setUrl] = useState<string | null>(null)
  useMemo(() => {
    if (!data) return setUrl(null)
    QRCode.toDataURL(data, { width: 220 }).then(setUrl)
  }, [data])
  return url
}

function ZkpPanel() {
  const [requestUrl, setRequestUrl] = useState<string | undefined>()
  const [proof, setProof] = useState('')
  const [verifyResult, setVerifyResult] = useState<any>(null)
  const qr = useQr(requestUrl)

  const startRequest = async () => {
    const r = await api<{ requestUrl: string; sessionId: string }>(
      '/api/zkp/request',
      { method: 'POST', body: JSON.stringify({}) }
    )
    setRequestUrl(r.requestUrl)
  }

  const verify = async () => {
    const payload = proof ? JSON.parse(proof) : { mock: true }
    const r = await api('/api/zkp/verify', {
      method: 'POST',
      body: JSON.stringify({ provider: 'steam', payload })
    })
    setVerifyResult(r)
  }

  return (
    <div style={{ border: '1px solid #ddd', padding: 16, borderRadius: 8 }}>
      <h3>ZKP (Reclaim)</h3>
      <button onClick={startRequest}>Create Proof Request</button>
      {requestUrl && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
          {qr && <img src={qr} width={220} height={220} />}
          <div>
            <div>Open in Reclaim app:</div>
            <a href={requestUrl} target="_blank">{requestUrl}</a>
          </div>
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <textarea
          rows={6}
          placeholder="Paste proof JSON here (or leave empty for mock)"
          value={proof}
          onChange={(e) => setProof(e.target.value)}
          style={{ width: '100%' }}
        />
      </div>
      <button onClick={verify}>Verify Proof</button>
      {verifyResult && (
        <pre style={{ background: '#f6f6f6', padding: 8 }}>{JSON.stringify(verifyResult, null, 2)}</pre>
      )}
    </div>
  )
}

function Nl2SqlPanel() {
  const [q, setQ] = useState('Show users who played Counter-Strike')
  const [sql, setSql] = useState('')
  const [rows, setRows] = useState<any[]>([])

  const run = async () => {
    const r = await api<{ sql: string; rows: any[] }>('/api/nl2sql/query', {
      method: 'POST',
      body: JSON.stringify({ question: q })
    })
    setSql(r.sql)
    setRows(r.rows)
  }

  return (
    <div style={{ border: '1px solid #ddd', padding: 16, borderRadius: 8 }}>
      <h3>NL2SQL (LangChain + Ollama)</h3>
      <input value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%' }} />
      <button onClick={run}>Run</button>
      {sql && (
        <>
          <div>SQL</div>
          <pre style={{ background: '#f6f6f6', padding: 8 }}>{sql}</pre>
        </>
      )}
      {rows.length > 0 && (
        <>
          <div>Result</div>
          <pre style={{ background: '#f6f6f6', padding: 8 }}>{JSON.stringify(rows, null, 2)}</pre>
        </>
      )}
    </div>
  )
}

export default function OriginalApp() {
  return (
    <WalletProvider>
      <div style={{ maxWidth: 900, margin: '24px auto', fontFamily: 'sans-serif', padding: 16 }}>
        <h2>ZK Steam Prototype</h2>
        <div style={{ marginBottom: 12 }}>
          <WalletConnectControls />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
          <ZkpPanel />
          <Nl2SqlPanel />
        </div>
      </div>
    </WalletProvider>
  )
}