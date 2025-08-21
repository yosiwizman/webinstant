'use client'

import { useState } from 'react'
import { X, Plus, Trash2, Save, Clock, MapPin } from 'lucide-react'

interface EditPanelProps {
  businessName: string
  businessType?: string
  initialData?: EditPanelData
  onClose: () => void
  onSave: (updates: EditPanelUpdates) => void
}

interface EditPanelData {
  menuItems?: MenuItem[]
  services?: Service[]
  staff?: Staff[]
  dailySpecial?: string
  cuisineType?: string
  emergencyService?: boolean
  serviceAreas?: string
  appointmentLink?: string
  products?: string
}

interface EditPanelUpdates {
  category: string
  timestamp: string
  menuItems?: MenuItem[]
  dailySpecial?: string
  cuisineType?: string
  services?: Service[]
  emergencyService?: boolean
  serviceAreas?: string
  staff?: Staff[]
  appointmentLink?: string
  products?: string
}

interface MenuItem {
  id: string
  name: string
  price: string
  description: string
  category?: string
}

interface Service {
  id: string
  name: string
  price: string
  description?: string
  duration?: string
}

interface Staff {
  id: string
  name: string
  title: string
  specialties?: string[]
}

export default function EditPanel({ 
  businessName, 
  businessType = 'general',
  initialData = {},
  onClose,
  onSave 
}: EditPanelProps) {
  // Detect business category from type
  const getBusinessCategory = (type: string): string => {
    const typeUpper = type.toUpperCase()
    
    if (typeUpper.includes('RESTAURANT') || typeUpper.includes('CAFE') || 
        typeUpper.includes('BAKERY') || typeUpper.includes('PIZZA') || 
        typeUpper.includes('DELI') || typeUpper.includes('BAR')) {
      return 'RESTAURANT'
    }
    
    if (typeUpper.includes('PLUMB') || typeUpper.includes('AUTO') || 
        typeUpper.includes('CLEAN') || typeUpper.includes('REPAIR') || 
        typeUpper.includes('ELECTRIC') || typeUpper.includes('HVAC') ||
        typeUpper.includes('LANDSCAP') || typeUpper.includes('PEST')) {
      return 'SERVICE'
    }
    
    if (typeUpper.includes('BEAUTY') || typeUpper.includes('SALON') || 
        typeUpper.includes('SPA') || typeUpper.includes('NAIL') || 
        typeUpper.includes('HAIR') || typeUpper.includes('BARBER')) {
      return 'BEAUTY'
    }
    
    return 'GENERAL'
  }

  const category = getBusinessCategory(businessType)
  
  // State for different business types
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialData.menuItems || [])
  const [services, setServices] = useState<Service[]>(initialData.services || [])
  const [staff, setStaff] = useState<Staff[]>(initialData.staff || [])
  const [dailySpecial, setDailySpecial] = useState(initialData.dailySpecial || '')
  const [cuisineType, setCuisineType] = useState(initialData.cuisineType || '')
  const [emergencyService, setEmergencyService] = useState(initialData.emergencyService || false)
  const [serviceAreas, setServiceAreas] = useState(initialData.serviceAreas || '')
  const [appointmentLink, setAppointmentLink] = useState(initialData.appointmentLink || '')
  const [products, setProducts] = useState(initialData.products || '')
  const [isSaving, setIsSaving] = useState(false)

  // Add new menu item
  const addMenuItem = () => {
    const newItem: MenuItem = {
      id: Date.now().toString(),
      name: '',
      price: '',
      description: '',
      category: 'Main'
    }
    setMenuItems([...menuItems, newItem])
  }

  // Update menu item
  const updateMenuItem = (id: string, field: keyof MenuItem, value: string) => {
    setMenuItems(menuItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  // Remove menu item
  const removeMenuItem = (id: string) => {
    setMenuItems(menuItems.filter(item => item.id !== id))
  }

  // Add new service
  const addService = () => {
    const newService: Service = {
      id: Date.now().toString(),
      name: '',
      price: '',
      description: '',
      duration: category === 'BEAUTY' ? '30 min' : undefined
    }
    setServices([...services, newService])
  }

  // Update service
  const updateService = (id: string, field: keyof Service, value: string) => {
    setServices(services.map(service => 
      service.id === id ? { ...service, [field]: value } : service
    ))
  }

  // Remove service
  const removeService = (id: string) => {
    setServices(services.filter(service => service.id !== id))
  }

  // Add staff member
  const addStaff = () => {
    const newStaff: Staff = {
      id: Date.now().toString(),
      name: '',
      title: '',
      specialties: []
    }
    setStaff([...staff, newStaff])
  }

  // Update staff
  const updateStaff = (id: string, field: keyof Staff, value: string | string[]) => {
    setStaff(staff.map(member => 
      member.id === id ? { ...member, [field]: value } : member
    ))
  }

  // Remove staff
  const removeStaff = (id: string) => {
    setStaff(staff.filter(member => member.id !== id))
  }

  // Handle save
  const handleSave = async () => {
    setIsSaving(true)
    
    const updates: EditPanelUpdates = {
      category,
      timestamp: new Date().toISOString()
    }

    if (category === 'RESTAURANT') {
      updates.menuItems = menuItems.filter(item => item.name && item.price)
      updates.dailySpecial = dailySpecial
      updates.cuisineType = cuisineType
    } else if (category === 'SERVICE') {
      updates.services = services.filter(service => service.name && service.price)
      updates.emergencyService = emergencyService
      updates.serviceAreas = serviceAreas
    } else if (category === 'BEAUTY') {
      updates.services = services.filter(service => service.name && service.price)
      updates.staff = staff.filter(member => member.name)
      updates.appointmentLink = appointmentLink
      updates.products = products
    }

    try {
      await onSave(updates)
      setTimeout(() => {
        setIsSaving(false)
        onClose()
      }, 1000)
    } catch (error) {
      console.error('Save failed:', error)
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">{businessName}</h2>
            <p className="text-blue-100 mt-1">
              Edit {category === 'RESTAURANT' ? 'Menu & Details' : 
                    category === 'SERVICE' ? 'Services & Coverage' : 
                    category === 'BEAUTY' ? 'Services & Staff' : 
                    'Business Details'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Restaurant Category */}
          {category === 'RESTAURANT' && (
            <div className="space-y-6">
              {/* Cuisine Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cuisine Type
                </label>
                <input
                  type="text"
                  value={cuisineType}
                  onChange={(e) => setCuisineType(e.target.value)}
                  placeholder="e.g., Italian, Mexican, American"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Daily Special */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Today&apos;s Special
                </label>
                <textarea
                  value={dailySpecial}
                  onChange={(e) => setDailySpecial(e.target.value)}
                  placeholder="Describe today's special dish..."
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Menu Items */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Menu Items</h3>
                  <button
                    onClick={addMenuItem}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Item
                  </button>
                </div>
                
                <div className="space-y-3">
                  {menuItems.map((item) => (
                    <div key={item.id} className="bg-gray-50 p-4 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateMenuItem(item.id, 'name', e.target.value)}
                          placeholder="Item name"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          value={item.price}
                          onChange={(e) => updateMenuItem(item.id, 'price', e.target.value)}
                          placeholder="Price (e.g., $12.99)"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => removeMenuItem(item.id)}
                          className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Remove
                        </button>
                      </div>
                      <textarea
                        value={item.description}
                        onChange={(e) => updateMenuItem(item.id, 'description', e.target.value)}
                        placeholder="Description"
                        rows={2}
                        className="mt-3 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Service Business Category */}
          {category === 'SERVICE' && (
            <div className="space-y-6">
              {/* Emergency Service Toggle */}
              <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                <div>
                  <h3 className="font-semibold text-gray-800">24/7 Emergency Service</h3>
                  <p className="text-sm text-gray-600 mt-1">Enable if you offer emergency services</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emergencyService}
                    onChange={(e) => setEmergencyService(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Service Areas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Service Areas
                </label>
                <textarea
                  value={serviceAreas}
                  onChange={(e) => setServiceAreas(e.target.value)}
                  placeholder="List cities or zip codes you serve..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Services List */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Services Offered</h3>
                  <button
                    onClick={addService}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Service
                  </button>
                </div>
                
                <div className="space-y-3">
                  {services.map((service) => (
                    <div key={service.id} className="bg-gray-50 p-4 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input
                          type="text"
                          value={service.name}
                          onChange={(e) => updateService(service.id, 'name', e.target.value)}
                          placeholder="Service name"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          value={service.price}
                          onChange={(e) => updateService(service.id, 'price', e.target.value)}
                          placeholder="Price (e.g., $50/hr)"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => removeService(service.id)}
                          className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Remove
                        </button>
                      </div>
                      <input
                        type="text"
                        value={service.description || ''}
                        onChange={(e) => updateService(service.id, 'description', e.target.value)}
                        placeholder="Brief description (optional)"
                        className="mt-3 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Beauty Category */}
          {category === 'BEAUTY' && (
            <div className="space-y-6">
              {/* Appointment Link */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Online Booking Link
                </label>
                <input
                  type="url"
                  value={appointmentLink}
                  onChange={(e) => setAppointmentLink(e.target.value)}
                  placeholder="https://your-booking-site.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Products */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Products We Carry
                </label>
                <textarea
                  value={products}
                  onChange={(e) => setProducts(e.target.value)}
                  placeholder="List product brands or types you sell..."
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Services with Duration */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Services & Treatments</h3>
                  <button
                    onClick={addService}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Service
                  </button>
                </div>
                
                <div className="space-y-3">
                  {services.map((service) => (
                    <div key={service.id} className="bg-gray-50 p-4 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <input
                          type="text"
                          value={service.name}
                          onChange={(e) => updateService(service.id, 'name', e.target.value)}
                          placeholder="Service name"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          value={service.price}
                          onChange={(e) => updateService(service.id, 'price', e.target.value)}
                          placeholder="Price"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="relative">
                          <Clock className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            value={service.duration || ''}
                            onChange={(e) => updateService(service.id, 'duration', e.target.value)}
                            placeholder="Duration"
                            className="pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 w-full"
                          />
                        </div>
                        <button
                          onClick={() => removeService(service.id)}
                          className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Staff Members */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">Our Team</h3>
                  <button
                    onClick={addStaff}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Staff
                  </button>
                </div>
                
                <div className="space-y-3">
                  {staff.map((member) => (
                    <div key={member.id} className="bg-purple-50 p-4 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input
                          type="text"
                          value={member.name}
                          onChange={(e) => updateStaff(member.id, 'name', e.target.value)}
                          placeholder="Staff name"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                        <input
                          type="text"
                          value={member.title}
                          onChange={(e) => updateStaff(member.id, 'title', e.target.value)}
                          placeholder="Title/Role"
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                        <button
                          onClick={() => removeStaff(member.id)}
                          className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Remove
                        </button>
                      </div>
                      <input
                        type="text"
                        value={member.specialties?.join(', ') || ''}
                        onChange={(e) => updateStaff(member.id, 'specialties', e.target.value.split(',').map(s => s.trim()))}
                        placeholder="Specialties (comma separated)"
                        className="mt-3 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* General Category (fallback) */}
          {category === 'GENERAL' && (
            <div className="text-center py-12">
              <p className="text-gray-600">
                Business type not recognized. Showing standard edit options.
              </p>
              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Hours
                  </label>
                  <textarea
                    placeholder="Enter your business hours..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Information
                  </label>
                  <input
                    type="text"
                    placeholder="Phone number"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between items-center">
          <p className="text-sm text-gray-600">
            {category === 'RESTAURANT' && `${menuItems.length} menu items`}
            {category === 'SERVICE' && `${services.length} services`}
            {category === 'BEAUTY' && `${services.length} services, ${staff.length} staff`}
            {category === 'GENERAL' && 'Standard business'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
