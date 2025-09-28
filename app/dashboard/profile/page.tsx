'use client'

import { ProfileForm } from '@/components/profile/profile-form'

export default function ProfilePage() {
  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Профиль</h1>
        <p className="mt-2 text-gray-600">
          Управляйте информацией о вашем профиле
        </p>
      </div>
      
      <div className="w-full">
        <ProfileForm />
      </div>
    </div>
  )
}
