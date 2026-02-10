// Example of how to use translations in your pages:
// 
// For Client Components:
import { useTranslations } from 'next-intl'

export default function MyClientComponent() {
  const t = useTranslations('common')
  return <button>{t('save')}</button>
}

// For Server Components:
import { getTranslations } from 'next-intl/server'

export default async function MyServerComponent() {
  const t = await getTranslations('common')
  return <h1>{t('loading')}</h1>
}

// You can also use nested keys:
const t = useTranslations('interventions.fields')
// Then use: t('client'), t('workDone'), etc.
