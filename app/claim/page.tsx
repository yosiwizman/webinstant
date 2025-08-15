export default function ClaimPage() {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold">Claim Your Business</h1>
      <p className="mt-4 text-gray-600">Start the claim process here</p>
      
      <div className="mt-8 max-w-md">
        <div className="bg-white shadow-lg rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Get Your Website Today!</h2>
          <p className="text-gray-600 mb-4">
            Complete website package including:
          </p>
          <ul className="list-disc list-inside mb-6 text-gray-600">
            <li>Custom domain name</li>
            <li>1 year of hosting</li>
            <li>SSL certificate</li>
            <li>Mobile responsive design</li>
          </ul>
          <p className="text-3xl font-bold text-green-600 mb-6">Only $150</p>
          
          <a 
            href="https://buy.stripe.com/test_6oUbJ07gb3hr2ki98AeME00"
            className="block w-full bg-blue-600 text-white text-center py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Complete Purchase →
          </a>
        </div>
      </div>
    </div>
  )
}