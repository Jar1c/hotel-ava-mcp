import { Link } from 'react-router'

export default function NotFound() {
  return (
    <div className="px-base py-section text-center">
      <h1 className="typo-display-xl mb-lg">404</h1>
      <p className="typo-body-md text-body mb-lg">The page you&apos;re looking for doesn&apos;t exist.</p>
      <div className="flex items-center justify-center gap-5">
        <Link to="/" className="text-primary typo-body-md hover:underline">Return Home</Link>
        <Link to="/help" className="text-primary typo-body-md hover:underline">Help Center</Link>
      </div>
    </div>
  )
}