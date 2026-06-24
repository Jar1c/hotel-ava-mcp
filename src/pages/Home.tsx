import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="px-base py-section">
      <h1 className="typo-display-xl mb-lg">Welcome to Hotel Ava</h1>
      <p className="typo-body-md text-body max-w-2xl">
        Experience personalized luxury at Hotel Ava. Browse our curated rooms, enjoy premium amenities, and let our smart recommendations find the perfect stay for you.
      </p>
      <div className="mt-xl">
        <Link
          to="/rooms"
          className="inline-block rounded-sm bg-primary text-on-primary px-lg py-sm typo-button-md hover:bg-primary-active transition-colors"
        >
          Browse Rooms
        </Link>
      </div>
    </div>
  )
}