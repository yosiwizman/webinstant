import React from 'react';

interface RestaurantTemplateProps {
  businessName: string;
  address: string;
  phone: string;
  hours: {
    [key: string]: string;
  };
  tagline: string;
}

const RestaurantTemplate: React.FC<RestaurantTemplateProps> = ({
  businessName,
  address,
  phone,
  hours,
  tagline
}) => {
  // Sample menu items
  const menuItems = {
    appetizers: [
      { name: 'Crispy Calamari', description: 'Fresh squid rings with marinara sauce', price: '$12.99' },
      { name: 'Bruschetta Trio', description: 'Three varieties of our house-made bruschetta', price: '$10.99' },
      { name: 'Spinach Artichoke Dip', description: 'Creamy blend served with tortilla chips', price: '$9.99' },
    ],
    mains: [
      { name: 'Grilled Salmon', description: 'Atlantic salmon with lemon butter sauce and seasonal vegetables', price: '$24.99' },
      { name: 'Ribeye Steak', description: '12oz prime cut with garlic mashed potatoes', price: '$32.99' },
      { name: 'Chicken Parmesan', description: 'Breaded chicken breast with marinara and mozzarella', price: '$18.99' },
      { name: 'Vegetable Risotto', description: 'Creamy arborio rice with seasonal vegetables', price: '$16.99' },
    ],
    desserts: [
      { name: 'Tiramisu', description: 'Classic Italian dessert with espresso and mascarpone', price: '$8.99' },
      { name: 'Chocolate Lava Cake', description: 'Warm chocolate cake with molten center', price: '$9.99' },
      { name: 'New York Cheesecake', description: 'Rich and creamy with berry compote', price: '$7.99' },
    ]
  };

  // Sample reviews
  const reviews = [
    { name: 'Sarah M.', rating: 5, text: 'Amazing food and wonderful service! The atmosphere is perfect for a special dinner.', date: '2 weeks ago' },
    { name: 'John D.', rating: 5, text: 'Best restaurant in town! The ribeye steak was cooked to perfection.', date: '1 month ago' },
    { name: 'Emily R.', rating: 4, text: 'Great experience overall. The desserts are to die for!', date: '1 month ago' },
    { name: 'Michael T.', rating: 5, text: 'Fantastic dining experience. Will definitely be coming back!', date: '2 months ago' },
  ];

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <svg
        key={i}
        className={`w-5 h-5 ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ));
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xl">R</span>
              </div>
              <span className="ml-3 text-xl font-bold text-gray-800">{businessName}</span>
            </div>
            <div className="hidden md:flex space-x-8">
              <a href="#home" className="text-gray-700 hover:text-orange-500 transition-colors">Home</a>
              <a href="#menu" className="text-gray-700 hover:text-orange-500 transition-colors">Menu</a>
              <a href="#hours" className="text-gray-700 hover:text-orange-500 transition-colors">Hours</a>
              <a href="#location" className="text-gray-700 hover:text-orange-500 transition-colors">Location</a>
              <a href="#reviews" className="text-gray-700 hover:text-orange-500 transition-colors">Reviews</a>
              <a href="#contact" className="text-gray-700 hover:text-orange-500 transition-colors">Contact</a>
            </div>
            <button className="md:hidden">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative h-[600px] bg-gradient-to-r from-orange-400 to-red-500">
        <div className="absolute inset-0 bg-black opacity-40"></div>
        <div className="relative max-w-7xl mx-auto px-4 h-full flex items-center">
          <div className="text-white">
            <h1 className="text-5xl md:text-7xl font-bold mb-4">{businessName}</h1>
            <p className="text-2xl md:text-3xl mb-8">{tagline}</p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button className="bg-white text-orange-500 px-8 py-3 rounded-full font-semibold hover:bg-orange-50 transition-colors">
                View Menu
              </button>
              <button className="border-2 border-white text-white px-8 py-3 rounded-full font-semibold hover:bg-white hover:text-orange-500 transition-colors">
                Make Reservation
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Menu Section */}
      <section id="menu" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">Our Menu</h2>
            <p className="text-gray-600 text-lg">Discover our delicious offerings</p>
          </div>

          {/* Appetizers */}
          <div className="mb-12">
            <h3 className="text-2xl font-semibold text-orange-500 mb-6">Appetizers</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {menuItems.appetizers.map((item, index) => (
                <div key={index} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-lg font-semibold text-gray-800">{item.name}</h4>
                    <span className="text-orange-500 font-bold">{item.price}</span>
                  </div>
                  <p className="text-gray-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Main Courses */}
          <div className="mb-12">
            <h3 className="text-2xl font-semibold text-orange-500 mb-6">Main Courses</h3>
            <div className="grid md:grid-cols-2 gap-6">
              {menuItems.mains.map((item, index) => (
                <div key={index} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-lg font-semibold text-gray-800">{item.name}</h4>
                    <span className="text-orange-500 font-bold">{item.price}</span>
                  </div>
                  <p className="text-gray-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Desserts */}
          <div>
            <h3 className="text-2xl font-semibold text-orange-500 mb-6">Desserts</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {menuItems.desserts.map((item, index) => (
                <div key={index} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-lg font-semibold text-gray-800">{item.name}</h4>
                    <span className="text-orange-500 font-bold">{item.price}</span>
                  </div>
                  <p className="text-gray-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Hours Section */}
      <section id="hours" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">Hours of Operation</h2>
            <p className="text-gray-600 text-lg">We're here to serve you</p>
          </div>
          <div className="max-w-2xl mx-auto bg-orange-50 rounded-2xl p-8">
            <div className="space-y-4">
              {Object.entries(hours).map(([day, time]) => (
                <div key={day} className="flex justify-between items-center py-3 border-b border-orange-200 last:border-0">
                  <span className="text-lg font-medium text-gray-800 capitalize">{day}</span>
                  <span className="text-lg text-gray-600">{time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Location Section */}
      <section id="location" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">Find Us</h2>
            <p className="text-gray-600 text-lg">Visit us at our location</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow-md p-8">
              <h3 className="text-2xl font-semibold text-gray-800 mb-6">Our Location</h3>
              <div className="space-y-4">
                <div className="flex items-start">
                  <svg className="w-6 h-6 text-orange-500 mt-1 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div>
                    <p className="font-medium text-gray-800">Address</p>
                    <p className="text-gray-600">{address}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <svg className="w-6 h-6 text-orange-500 mt-1 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <div>
                    <p className="font-medium text-gray-800">Phone</p>
                    <p className="text-gray-600">{phone}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <svg className="w-6 h-6 text-orange-500 mt-1 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <p className="font-medium text-gray-800">Email</p>
                    <p className="text-gray-600">info@restaurant.com</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-300 rounded-lg shadow-md h-96 flex items-center justify-center">
              <p className="text-gray-600">Map placeholder</p>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <section id="reviews" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-800 mb-4">Customer Reviews</h2>
            <p className="text-gray-600 text-lg">What our customers are saying</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {reviews.map((review, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  {renderStars(review.rating)}
                </div>
                <p className="text-gray-700 mb-4">{review.text}</p>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-800">{review.name}</p>
                  <p className="text-sm text-gray-500">{review.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-16 bg-gradient-to-r from-orange-400 to-red-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-white">
            <h2 className="text-4xl font-bold mb-4">Ready to Dine With Us?</h2>
            <p className="text-xl mb-8">Make a reservation or contact us for any inquiries</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-white text-orange-500 px-8 py-3 rounded-full font-semibold hover:bg-orange-50 transition-colors">
                Call {phone}
              </button>
              <button className="border-2 border-white text-white px-8 py-3 rounded-full font-semibold hover:bg-white hover:text-orange-500 transition-colors">
                Book a Table
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p className="text-lg font-semibold">{businessName}</p>
              <p className="text-gray-400">{tagline}</p>
            </div>
            <div className="flex space-x-6">
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zM5.838 12a6.162 6.162 0 1112.324 0 6.162 6.162 0 01-12.324 0zM12 16a4 4 0 110-8 4 4 0 010 8zm4.965-10.405a1.44 1.44 0 112.881.001 1.44 1.44 0 01-2.881-.001z"/>
                </svg>
              </a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-700 text-center text-gray-400">
            <p>&copy; 2024 {businessName}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default RestaurantTemplate;
