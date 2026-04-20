import { useState } from 'react'
import InvoiceDemo from './InvoiceDemo'
import WorkflowCreator from './WorkflowCreator'

type Page = 'demo' | 'creator'

function App() {
  const [page, setPage] = useState<Page>('demo')

  return (
    <>
      {page === 'creator'
        ? <WorkflowCreator onBack={() => setPage('demo')} />
        : (
          <main className="min-h-screen bg-gray-950 text-gray-100">
            {/* Nav */}
            <nav className="flex items-center gap-2 px-5 py-2 bg-gray-900 border-b border-gray-800">
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">Invoice App</span>
              <div className="ml-auto flex gap-2">
                <NavButton active={page === 'demo'} onClick={() => setPage('demo')}>Demo</NavButton>
                <NavButton active={false} onClick={() => setPage('creator')}>Workflow Creator</NavButton>
              </div>
            </nav>
            <InvoiceDemo />
          </main>
        )
      }
    </>
  )
}

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all ${active
          ? 'bg-violet-700 border-violet-500 text-white'
          : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
        }`}
    >
      {children}
    </button>
  )
}

export default App
