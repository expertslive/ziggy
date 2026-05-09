import heroImage from '../../assets/studiebeurs-hero.webp'
import { useNominateLang, type NominateLang } from '../../i18n/nominate'

/** Hero band for the public /nominate page. ~30vh tall, reuses the
 *  Studiebeurs cover image with a dark gradient overlay so the headline
 *  reads on every region of the photo. Top-right hosts a small NL/EN pill
 *  toggle that drives useNominateLang(); bottom-left holds the program
 *  pill + the H1 headline + emoji. */
export function Hero() {
  const { lang, setLang, t } = useNominateLang()

  return (
    <header className="relative min-h-[30vh] w-full overflow-hidden bg-el-light">
      <img
        src={heroImage}
        alt=""
        loading="eager"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-el-darker/50 via-el-darker/40 to-el-darker/70" />

      <div className="absolute top-3 right-3 z-10">
        <LangPill lang={lang} setLang={setLang} labelNL={t('langNL')} labelEN={t('langEN')} />
      </div>

      <div className="relative z-10 flex min-h-[30vh] flex-col justify-end px-5 py-5 sm:px-6 sm:py-6">
        <span className="self-start mb-3 px-3 py-1 rounded-full bg-el-darker/70 backdrop-blur-sm text-white text-xs sm:text-sm font-bold uppercase tracking-wider">
          {t('pill')}
        </span>
        <h1 className="text-white font-extrabold leading-tight text-3xl sm:text-4xl">
          {t('headline')} <span aria-hidden="true">{t('headlineEmoji')}</span>
        </h1>
      </div>
    </header>
  )
}

function LangPill({
  lang,
  setLang,
  labelNL,
  labelEN,
}: {
  lang: NominateLang
  setLang: (l: NominateLang) => void
  labelNL: string
  labelEN: string
}) {
  return (
    <div
      role="group"
      aria-label="Language"
      className="flex items-center gap-1 rounded-full bg-el-darker/50 backdrop-blur-sm p-1 ring-1 ring-white/30"
    >
      <LangButton active={lang === 'nl'} onClick={() => setLang('nl')} label={labelNL} />
      <LangButton active={lang === 'en'} onClick={() => setLang('en')} label={labelEN} />
    </div>
  )
}

function LangButton({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  const base =
    'min-w-10 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors'
  const cls = active
    ? 'bg-white text-el-darker'
    : 'bg-transparent text-white hover:bg-white/10'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${base} ${cls}`}
    >
      {label}
    </button>
  )
}
