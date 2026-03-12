'use client'

import { COUNTRIES, getDistricts, getCities } from '@/lib/location-data'
import { useTranslations } from 'next-intl'
import SelectDropdown from './SelectDropdown'

interface Props {
  country: string
  district: string
  city: string
  onCountryChange: (v: string) => void
  onDistrictChange: (v: string) => void
  onCityChange: (v: string) => void
  /** 'xs' for compact label text (inside nested forms), 'sm' default */
  labelSize?: 'xs' | 'sm'
}

export default function LocationSelector({
  country,
  district,
  city,
  onCountryChange,
  onDistrictChange,
  onCityChange,
  labelSize = 'sm',
}: Props) {
  const tClients = useTranslations('clients')

  const districts = getDistricts(country)
  const cities = getCities(country, district)
  const labelCls = `block text-${labelSize} font-medium text-gray-700 mb-1`

  const countryOptions = [
    { value: '', label: tClients('selectCountry') },
    ...COUNTRIES.map(c => ({ value: c, label: c })),
  ]
  const districtOptions = [
    { value: '', label: tClients('selectDistrict') },
    ...districts.map(d => ({ value: d, label: d })),
  ]
  const cityOptions = [
    { value: '', label: tClients('selectCity') },
    ...cities.map(c => ({ value: c, label: c })),
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div>
        <label className={labelCls}>{tClients('country')}</label>
        <SelectDropdown
          value={country}
          options={countryOptions}
          onChange={onCountryChange}
        />
      </div>

      <div>
        <label className={labelCls}>{tClients('district')}</label>
        <SelectDropdown
          value={district}
          options={districtOptions}
          disabled={!country}
          onChange={onDistrictChange}
        />
      </div>

      <div>
        <label className={labelCls}>{tClients('city')}</label>
        {cities.length > 0 ? (
          <SelectDropdown
            value={city}
            options={cityOptions}
            onChange={onCityChange}
          />
        ) : (
          <input
            type="text"
            className="input text-gray-800"
            value={city}
            placeholder={tClients('city')}
            onChange={(e) => onCityChange(e.target.value)}
          />
        )}
      </div>
    </div>
  )
}
