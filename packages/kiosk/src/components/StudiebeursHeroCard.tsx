import { Trans, useTranslation } from 'react-i18next'
import heroImage from '../assets/studiebeurs-hero.webp'

/** Hero card for the Experts Live Studiebeurs — sits next to the Octocat
 *  hero on /shop and gives the scholarship initiative equal visual
 *  weight: image, emotional headline, pitch with bold amount, 3-step
 *  explainer, and a small footnote. Matches ShopCard styling so the two
 *  hero cards balance under `items-stretch` on the parent grid. */
export function StudiebeursHeroCard() {
  const { t } = useTranslation()
  const steps: ('step1' | 'step2' | 'step3')[] = ['step1', 'step2', 'step3']
  return (
    <div className="bg-white rounded-2xl flex flex-col overflow-hidden ring-1 ring-el-blue/30">
      <div className="aspect-[3/2] w-full bg-el-light overflow-hidden">
        <img
          src={heroImage}
          alt=""
          loading="eager"
          decoding="async"
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-5 sm:p-6 flex flex-col gap-4 flex-1">
        <h2 className="text-xl sm:text-2xl font-extrabold text-el-dark leading-tight">
          {t('shop.studiebeurs.hero.headline')}
        </h2>
        <p className="text-el-dark/80 leading-relaxed text-sm sm:text-base">
          <Trans
            i18nKey="shop.studiebeurs.hero.pitch"
            components={{ strong: <strong className="text-el-blue font-extrabold" /> }}
          />
        </p>
        <ol className="space-y-2.5 mt-1">
          {steps.map((key, idx) => (
            <li
              key={key}
              className="flex items-start gap-3 text-sm sm:text-base text-el-dark/85"
            >
              <span
                aria-hidden="true"
                className="shrink-0 w-6 h-6 rounded-full bg-el-blue text-white text-xs font-bold flex items-center justify-center mt-0.5"
              >
                {idx + 1}
              </span>
              <span>{t(`shop.studiebeurs.hero.${key}`)}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs sm:text-sm text-el-dark/55 italic mt-auto">
          {t('shop.studiebeurs.hero.footnote')}
        </p>
      </div>
    </div>
  )
}
