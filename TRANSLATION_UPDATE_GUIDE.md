# Translation Implementation Guide

I've already updated these core files with translations:
- ✅ Login Page (`app/[locale]/page.tsx`)
- ✅ Navigation (`components/Navigation.tsx`)  
- ✅ Dashboard (`app/[locale]/dashboard/page.tsx`)

## Files Still Needing Translation Updates

Due to the large number of files, I've prepared the translation infrastructure. Here's what you need to do for the remaining pages:

### Pattern to Follow

**Before (hardcoded text):**
```typescript
export default function MyPage() {
  return <button>Save</button>
}
```

**After (with translations):**
```typescript
'use client'
import { useTranslations } from 'next-intl'

export default function MyPage() {
  const t = useTranslations('common')
  return <button>{t('save')}</button>
}
```

### Quick Reference for Each Section

**Clients Pages:**
- Use: `useTranslations('clients')`
- Keys: `title`, `subtitle`, `addClient`, `clientName`, `address`, `city`, etc.

**Interventions Pages:**
- Use: `useTranslations('interventions')`
- Keys: `title`, `subtitle`, `newIntervention`, `createTitle`, etc.
- Status: `useTranslations('interventions.status')` for status labels
- Fields: `useTranslations('interventions.fields')` for form labels

**Admin Pages:**
- Use: `useTranslations('admin')`
- Keys: `title`, `subtitle`, `addUser`, `totalUsers`, etc.
- Roles: `useTranslations('admin.roles')` for role names

**Common Elements:**
- Use: `useTranslations('common')`
- Keys: `save`, `cancel`, `delete`, `edit`, `loading`, `back`, etc.

**Errors:**
- Use: `useTranslations('errors')`
- Keys: `unauthorized`, `notFound`, `serverError`, etc.

## Automated Translation Update Script

I'll create a bash script that updates all remaining files automatically...
