import Link from 'next/link';

export default function Home() {
  return (
    <main className="container" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      textAlign: 'center'
    }}>
      <h1 className="title-gradient" style={{ fontSize: '4rem', marginBottom: '1rem' }}>
        FotoBuddy
      </h1>
      <p style={{ fontSize: '1.25rem', color: '#94a3b8', marginBottom: '3rem', maxWidth: '600px' }}>
        Next-gen fotobudka s ovládáním přes mobil. Připojte zrcadlovku, tiskárnu a bavte se!
      </p>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/kiosk" className="btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.1rem', textDecoration: 'none' }}>
          Spustit Kiosk (Host)
        </Link>
        <Link href="/remote" className="glass-panel" style={{ padding: '1rem 2rem', color: 'white', textDecoration: 'none', fontWeight: 600 }}>
          Připojit se (Remote)
        </Link>
      </div>

      <div style={{ marginTop: '4rem', padding: '1.5rem', borderTop: '1px solid var(--glass-border)' }}>
        <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
          Postaveno pro Canon DSLR & Railway
        </p>
      </div>
    </main>
  );
}
