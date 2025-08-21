import React from 'react';

interface ServiceTemplateProps {
  businessName: string;
  address: string;
  phone: string;
  hours: {
    [key: string]: string;
  };
  tagline: string;
  services: string[];
  serviceArea: string;
}

const ServiceTemplate: React.FC<ServiceTemplateProps> = ({
  businessName,
  address,
  phone,
  hours,
  tagline,
  services,
  serviceArea,
}) => {
  // Icons for common services - you can expand this mapping
  const getServiceIcon = (service: string): string => {
    const serviceLower = service.toLowerCase();
    if (serviceLower.includes('repair')) return '🔧';
    if (serviceLower.includes('install')) return '⚙️';
    if (serviceLower.includes('maintenance')) return '🛠️';
    if (serviceLower.includes('emergency')) return '🚨';
    if (serviceLower.includes('inspection')) return '🔍';
    if (serviceLower.includes('cleaning')) return '🧹';
    if (serviceLower.includes('plumb')) return '🚿';
    if (serviceLower.includes('electric')) return '⚡';
    if (serviceLower.includes('hvac') || serviceLower.includes('heating') || serviceLower.includes('cooling')) return '❄️';
    return '✓';
  };

  const formatPhoneForTel = (phoneNumber: string): string => {
    return phoneNumber.replace(/\D/g, '');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-4">{businessName}</h1>
            <p className="text-xl md:text-2xl mb-8 opacity-95">{tagline}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={`tel:${formatPhoneForTel(phone)}`}
                className="inline-flex items-center justify-center px-8 py-4 bg-white text-blue-600 font-bold text-lg rounded-lg hover:bg-gray-100 transition-colors shadow-lg"
              >
                <span className="mr-2">📞</span>
                Call Now: {phone}
              </a>
              <a
                href="#contact"
                className="inline-flex items-center justify-center px-8 py-4 bg-blue-500 text-white font-bold text-lg rounded-lg hover:bg-blue-400 transition-colors shadow-lg"
              >
                Get Free Quote
              </a>
            </div>
            <div className="mt-8 text-lg">
              <span className="inline-flex items-center">
                <span className="mr-2">📍</span>
                Serving {serviceArea}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Indicators Bar */}
      <section className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-wrap justify-center items-center gap-8 text-gray-600">
            <div className="flex items-center">
              <span className="text-2xl mr-2">✓</span>
              <span>Licensed & Insured</span>
            </div>
            <div className="flex items-center">
              <span className="text-2xl mr-2">⭐</span>
              <span>5-Star Rated</span>
            </div>
            <div className="flex items-center">
              <span className="text-2xl mr-2">🏆</span>
              <span>20+ Years Experience</span>
            </div>
            <div className="flex items-center">
              <span className="text-2xl mr-2">⚡</span>
              <span>24/7 Emergency Service</span>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16 bg-white" id="services">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Our Services</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Professional, reliable service you can trust. We handle all your needs with expertise and care.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {services.map((service, index) => (
              <div
                key={index}
                className="bg-gray-50 rounded-lg p-6 hover:shadow-lg transition-shadow border border-gray-200"
              >
                <div className="text-4xl mb-4">{getServiceIcon(service)}</div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">{service}</h3>
                <p className="text-gray-600">
                  Expert {service.toLowerCase()} services delivered with professionalism and attention to detail.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section className="py-16 bg-gray-50" id="about">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-6">
                About {businessName}
              </h2>
              <p className="text-gray-600 mb-4 leading-relaxed">
                With over two decades of experience serving {serviceArea}, we&apos;ve built our reputation on quality 
                workmanship, honest pricing, and exceptional customer service. Our team of certified professionals 
                is committed to solving your problems quickly and efficiently.
              </p>
              <p className="text-gray-600 mb-6 leading-relaxed">
                We understand that inviting service professionals into your home or business requires trust. 
                That&apos;s why all our technicians are background-checked, fully licensed, and insured. We stand 
                behind our work with comprehensive warranties and guarantees.
              </p>
              <div className="bg-blue-100 border-l-4 border-blue-600 p-4 rounded">
                <p className="text-blue-800 font-semibold">
                  &quot;Your satisfaction is our top priority. We&apos;re not happy until you&apos;re happy.&quot;
                </p>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Business Hours</h3>
              <div className="space-y-3">
                {Object.entries(hours).map(([day, time]) => (
                  <div key={day} className="flex justify-between py-2 border-b border-gray-200">
                    <span className="font-medium text-gray-700">{day}</span>
                    <span className="text-gray-600">{time}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-4 bg-red-50 rounded-lg">
                <p className="text-red-800 font-semibold text-center">
                  🚨 24/7 Emergency Service Available
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              Why Choose {businessName}?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              We go above and beyond to ensure your complete satisfaction
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">💰</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Fair Pricing</h3>
              <p className="text-gray-600">
                Transparent, upfront pricing with no hidden fees or surprises
              </p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">⏰</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">On-Time Service</h3>
              <p className="text-gray-600">
                We respect your time and always arrive within the scheduled window
              </p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🛡️</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Guaranteed Work</h3>
              <p className="text-gray-600">
                All our services come with a satisfaction guarantee
              </p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">👨‍🔧</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Expert Technicians</h3>
              <p className="text-gray-600">
                Certified, experienced professionals you can trust
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
              What Our Customers Say
            </h2>
            <p className="text-lg text-gray-600">
              Don&apos;t just take our word for it
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-yellow-400 text-xl">⭐</span>
                ))}
              </div>
              <p className="text-gray-600 mb-4 italic">
                &quot;Excellent service! They arrived on time, diagnosed the problem quickly, and had everything 
                fixed within an hour. Very professional and clean work. Highly recommend!&quot;
              </p>
              <div className="font-semibold text-gray-800">- Sarah Johnson</div>
              <div className="text-sm text-gray-500">Residential Customer</div>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-yellow-400 text-xl">⭐</span>
                ))}
              </div>
              <p className="text-gray-600 mb-4 italic">
                &quot;We&apos;ve been using their services for our business for years. Always reliable, fair pricing, 
                and they stand behind their work. Can&apos;t ask for more!&quot;
              </p>
              <div className="font-semibold text-gray-800">- Mike Chen</div>
              <div className="text-sm text-gray-500">Commercial Client</div>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex mb-4">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-yellow-400 text-xl">⭐</span>
                ))}
              </div>
              <p className="text-gray-600 mb-4 italic">
                &quot;Had an emergency late at night and they came right away. The technician was knowledgeable 
                and explained everything clearly. Saved the day!&quot;
              </p>
              <div className="font-semibold text-gray-800">- Emily Rodriguez</div>
              <div className="text-sm text-gray-500">Emergency Service</div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section className="py-16 bg-white" id="contact">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
                Get Your Free Quote
              </h2>
              <p className="text-lg text-gray-600">
                Fill out the form below and we&apos;ll get back to you within 24 hours
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg shadow-lg p-8">
              <form className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label htmlFor="service" className="block text-sm font-medium text-gray-700 mb-2">
                    Service Needed
                  </label>
                  <select
                    id="service"
                    name="service"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a service...</option>
                    {services.map((service, index) => (
                      <option key={index} value={service}>
                        {service}
                      </option>
                    ))}
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                    Describe Your Issue
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Please describe what you need help with..."
                  ></textarea>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="emergency"
                    name="emergency"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="emergency" className="ml-2 block text-sm text-gray-700">
                    This is an emergency (we&apos;ll prioritize your request)
                  </label>
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white font-bold py-4 px-6 rounded-lg hover:bg-blue-700 transition-colors text-lg shadow-lg"
                >
                  Get Free Quote
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div>
              <h3 className="text-xl font-bold mb-4">{businessName}</h3>
              <p className="text-gray-300 mb-4">{tagline}</p>
              <div className="flex space-x-4">
                <span className="text-2xl">📘</span>
                <span className="text-2xl">🐦</span>
                <span className="text-2xl">📷</span>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-4">Contact Info</h3>
              <div className="space-y-2 text-gray-300">
                <p className="flex items-center">
                  <span className="mr-2">📞</span>
                  <a href={`tel:${formatPhoneForTel(phone)}`} className="hover:text-white">
                    {phone}
                  </a>
                </p>
                <p className="flex items-center">
                  <span className="mr-2">📍</span>
                  {address}
                </p>
                <p className="flex items-center">
                  <span className="mr-2">🗺️</span>
                  Serving {serviceArea}
                </p>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-4">Quick Links</h3>
              <ul className="space-y-2 text-gray-300">
                <li><a href="#services" className="hover:text-white">Our Services</a></li>
                <li><a href="#about" className="hover:text-white">About Us</a></li>
                <li><a href="#contact" className="hover:text-white">Get Quote</a></li>
                <li><a href="#" className="hover:text-white">Emergency Service</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 {businessName}. All rights reserved. | Licensed & Insured</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ServiceTemplate;
