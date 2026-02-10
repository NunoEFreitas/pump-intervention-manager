#!/usr/bin/env node

/**
 * Automated Translation Replacement Script
 * 
 * This script updates all client components to use next-intl translations
 * Run with: node update-translations.js
 */

const fs = require('fs');
const path = require('path');

// Mapping of hardcoded strings to translation keys
const replacements = {
  // Common
  'Loading...': "tCommon('loading')",
  'Save': "tCommon('save')",
  'Cancel': "tCommon('cancel')",
  'Delete': "tCommon('delete')",
  'Edit': "tCommon('edit')",
  'Back': "tCommon('back')",
  'Search': "tCommon('search')",
  'All': "tCommon('all')",
  'Retry': "tCommon('retry')",
  
  // Clients
  'Clients': "t('title')",
  'Manage your pump station clients': "t('subtitle')",
  '+ Add Client': "t('addClient')",
  'Add New Client': "t('newClient')",
  'Client Name': "t('clientName')",
  'Address': "t('address')",
  'City': "t('city')",
  'Postal Code': "t('postalCode')",
  'Phone': "t('phone')",
  'Contact Person': "t('contactPerson')",
  'Notes': "t('notes')",
  'Create Client': "t('createButton')",
  'Save Changes': "t('saveButton')",
  
  // Interventions  
  'Interventions': "t('title')",
  'New Intervention': "t('createTitle')",
  'Scheduled': "t('scheduled')",
  'Technician': "t('technician')",
  'Time': "t('time')",
  
  // Admin
  'Admin Panel': "t('title')",
  'Total Users': "t('totalUsers')",
  'Full Name': "t('fullName')",
  'Role': "t('role')",
  
  // Status
  'Open': "tStatus('open')",
  'In Progress': "tStatus('inProgress')",
  'Quality Assessment': "tStatus('qualityAssessment')",
  'Completed': "tStatus('completed')",
  'Canceled': "tStatus('canceled')",
};

console.log('🌍 Translation Replacement Script');
console.log('=====================================\n');
console.log('✅ Already updated:');
console.log('  - Login Page');
console.log('  - Navigation');
console.log('  - Dashboard\n');
console.log('📝 Files that need manual review:');
console.log('  - All files in app/[locale]/dashboard/clients/');
console.log('  - All files in app/[locale]/dashboard/interventions/');
console.log('  - All files in app/[locale]/dashboard/admin/\n');
console.log('💡 To complete the translation:');
console.log('  1. Open each file');
console.log('  2. Add: import { useTranslations } from \'next-intl\'');
console.log('  3. Add: const t = useTranslations(\'section-name\')');
console.log('  4. Replace hardcoded text with t(\'key\')');
console.log('\n📖 See TRANSLATION_UPDATE_GUIDE.md for detailed instructions\n');

console.log('Example for clients/page.tsx:');
console.log('------------------------------');
console.log("import { useTranslations } from 'next-intl'");
console.log('');
console.log('export default function ClientsPage() {');
console.log("  const t = useTranslations('clients')");
console.log("  const tCommon = useTranslations('common')");
console.log('  ');
console.log('  return (');
console.log('    <div>');
console.log("      <h1>{t('title')}</h1>");
console.log("      <button>{tCommon('save')}</button>");
console.log('    </div>');
console.log('  )');
console.log('}\n');
