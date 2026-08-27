import { Calculator } from 'lucide-react'
import { PageLayout, PageBody } from '../components/PageLayout'

export default function ContabilitaConteggiPage() {
  return (
    <PageLayout>
      <PageBody>
        <div className="mx-auto max-w-[1180px] px-3 py-4 md:px-5">
          <div className="flex min-h-[55vh] items-center justify-center">
            <section className="w-full max-w-[680px] rounded-[28px] border border-[#d9b45f]/45 bg-[linear-gradient(145deg,#fffdf7,#fff8e7)] p-8 text-center shadow-[0_24px_70px_-42px_rgba(125,87,15,.55)]">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f4e7c2] text-[#98701f]">
                <Calculator size={24}/>
              </div>
              <h1 className="mt-5 text-[18px] font-black uppercase tracking-[0.18em] text-[#3d2a0b]">
                Contabilità Conteggi
              </h1>
              <p className="mx-auto mt-3 max-w-[460px] text-[12px] font-semibold leading-6 text-black/45">
                Sezione predisposta. La pagina verrà completata con il flusso contabile definitivo dei conteggi.
              </p>
            </section>
          </div>
        </div>
      </PageBody>
    </PageLayout>
  )
}
