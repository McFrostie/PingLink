import { useEffect, useState } from 'react';
import {
  ArrowLeft, Share2, MapPin, Star,
  MessageSquare, CheckCircle2, Navigation, Phone, Globe,
} from 'lucide-react';
import { useVenueStore } from '../stores/venueStore';
import { useAuthStore } from '../stores/authStore';
import { toggleCheckin, isCheckedIn } from '../lib/queries/venues';

/**
 * Parse opening hours and determine if venue is currently open.
 * Format: "Mon-Fri: 9am-10pm, Sat-Sun: 10am-8pm"
 * Returns true if open, false if closed, null if unparseable.
 */
function isOpenNow(openingHours: any): boolean | null {
  if (!openingHours || typeof openingHours !== 'object') return null;
  
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  // Map day of week to key names (assuming opening_hours is stored as object)
  const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const todayKey = dayKeys[dayOfWeek];
  
  const todayHours = openingHours[todayKey];
  if (!todayHours || !todayHours.open || !todayHours.close) return null;
  
  // Parse time strings like "9am" or "10pm" → minutes since midnight
  const parseTime = (timeStr: string): number | null => {
    const match = timeStr.match(/(\d+)(am|pm)/i);
    if (!match) return null;
    let hours = parseInt(match[1]);
    const meridiem = match[2].toLowerCase();
    if (meridiem === 'pm' && hours !== 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    return hours * 60;
  };
  
  const openMinutes = parseTime(todayHours.open);
  const closeMinutes = parseTime(todayHours.close);
  
  if (openMinutes === null || closeMinutes === null) return null;
  
  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

// ─── Loading skeleton ──────────────────────────────────────────────────────
function VenueSkeleton() {
  return (
    <div className="min-h-full bg-gray-50 animate-pulse">
      <div className="h-72 bg-gray-200" />
      <div className="-mt-6 bg-gray-50 rounded-t-3xl pt-7 px-5 space-y-4">
        <div className="h-7 w-2/3 bg-gray-200 rounded-full" />
        <div className="h-4 w-full bg-gray-200 rounded-full" />
        <div className="flex gap-2">
          <div className="h-6 w-20 bg-gray-200 rounded-full" />
          <div className="h-6 w-16 bg-gray-200 rounded-full" />
        </div>
        <div className="flex gap-3 pt-1">
          <div className="flex-1 h-12 bg-gray-200 rounded-2xl" />
          <div className="flex-1 h-12 bg-gray-200 rounded-2xl" />
        </div>
        <div className="h-28 bg-gray-200 rounded-2xl" />
        <div className="h-20 bg-gray-200 rounded-2xl" />
      </div>
    </div>
  );
}

// ─── Section panel ─────────────────────────────────────────────────────────
function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function VenueDetailScreen({
  onBack,
  venueId,
}: {
  onBack: () => void;
  venueId: string;
}) {
  const { session, profile } = useAuthStore();
  const { selectedVenue, isLoadingDetail, fetchDetail } = useVenueStore();
  const [checkedIn, setCheckedIn] = useState(false);
  const [isTogglingCheckin, setIsTogglingCheckin] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const userId = session?.user?.id;
  const { submitReview } = useVenueStore();

  useEffect(() => {
    if (venueId) fetchDetail(venueId);
  }, [venueId]);

  // Check if current user is already checked in
  useEffect(() => {
    if (userId && venueId) {
      isCheckedIn(userId, venueId).then(setCheckedIn);
    }
  }, [userId, venueId]);

  const handleCheckin = async () => {
    if (!userId || !venueId || isTogglingCheckin) return;
    setIsTogglingCheckin(true);
    try {
      const result = await toggleCheckin(userId, venueId);
      setCheckedIn(result === 'checked_in');
      // Re-fetch to update player count
      fetchDetail(venueId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error occurred';
      alert(`Failed to check in: ${msg}`);
    } finally {
      setIsTogglingCheckin(false);
    }
  };

  const handleDirections = () => {
    if (!selectedVenue) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedVenue.latitude},${selectedVenue.longitude}`;
    window.open(url, '_blank');
  };

  const handleSubmitReview = async () => {
    if (!venueId || !userId || isSubmittingReview) return;
    setIsSubmittingReview(true);
    try {
      const success = await submitReview(venueId, reviewRating, reviewBody);
      if (success) {
        setShowReviewForm(false);
        setReviewBody('');
        setReviewRating(5);
        alert('Review submitted successfully!');
      } else {
        alert('Failed to submit review. Please try again.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error occurred';
      alert(`Failed to submit review: ${msg}`);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const userHasReviewed = selectedVenue?.reviews.some(r => r.reviewer_name === profile?.full_name) ?? false;

  // ── Loading state ───────────────────────────────────────────────────────────
  if (isLoadingDetail) return <VenueSkeleton />;

  if (!selectedVenue) {
    return (
      <div className="min-h-full bg-gray-50 flex flex-col items-center justify-center gap-3 px-6">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-1">
          <MapPin size={22} className="text-gray-400" />
        </div>
        <p className="text-gray-900 font-semibold text-base">Venue not found</p>
        <p className="text-gray-500 text-sm text-center">This venue may no longer be available.</p>
        <button
          onClick={onBack}
          className="mt-2 h-11 px-6 rounded-full bg-gray-900 text-white text-sm font-medium active:scale-95 transition-transform"
        >
          Go back
        </button>
      </div>
    );
  }

  const venue = selectedVenue;
  const photos = venue.photos.length > 0 ? venue.photos : null;
  const currentPhoto = photos?.[activePhotoIndex] ?? null;
  const openStatus = isOpenNow(venue.opening_hours);

  return (
    <div className="h-full w-full flex flex-col bg-gray-50 overflow-hidden relative">

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto overscroll-y-contain relative pb-[calc(env(safe-area-inset-bottom)+120px)]">

        {/* Hero image */}
        <div className="relative h-72 sm:h-80 w-full overflow-hidden bg-gray-200">
          {currentPhoto ? (
            <img src={currentPhoto.url} alt={venue.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-200">
              <MapPin size={48} className="text-gray-400" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/20" />

          {/* Nav */}
          <div className="absolute top-0 left-0 w-full pt-[calc(env(safe-area-inset-top,0px)+1rem)] px-5 z-20 flex justify-between items-center">
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <button className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-colors">
              <Share2 size={20} />
            </button>
          </div>

          {/* Photo dots */}
          {photos && photos.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActivePhotoIndex(i)}
                  className={`w-2 h-2 rounded-full transition-all ${i === activePhotoIndex ? 'bg-white' : 'bg-white/50'}`}
                />
              ))}
            </div>
          )}

          {/* Verified badge */}
          {venue.is_verified && (
            <div className="absolute top-[calc(env(safe-area-inset-top,0px)+4rem)] right-5 z-20 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
              <CheckCircle2 size={14} className="text-gray-600" />
              <span className="text-xs font-semibold text-gray-700">Verified</span>
            </div>
          )}
        </div>

        {/* ── Content ── */}
        <div className="relative z-30 -mt-6 bg-gray-50 rounded-t-3xl pt-7 px-5 sm:px-6">

          {/* Name + rating */}
          <div className="mb-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h1 className="font-display font-bold text-2xl text-gray-900 tracking-tight leading-tight flex-1">
                {venue.name}
              </h1>
              {venue.average_rating > 0 && (
                <div className="flex items-center gap-1 bg-gray-100 px-2.5 py-1 rounded-full shrink-0">
                  <Star size={13} className="text-yellow-500 fill-yellow-500" />
                  <span className="font-semibold text-gray-700 text-sm">
                    {venue.average_rating.toFixed(1)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-start gap-1.5 text-gray-500 mb-4">
              <MapPin size={15} className="shrink-0 mt-0.5 text-gray-400" />
              <p className="text-sm leading-snug">{venue.address}</p>
            </div>

            {/* Status chips */}
            <div className="flex items-center gap-2 flex-wrap">
              {venue.facility_type && (
                <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600 capitalize">
                  {venue.facility_type.replace(/_/g, ' ')}
                </span>
              )}
              {openStatus !== null && (
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  openStatus ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  {openStatus ? 'Open now' : 'Closed'}
                </span>
              )}
              {venue.num_tables > 0 && (
                <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                  {venue.num_tables} tables
                </span>
              )}
              {venue.checkin_count > 0 && (
                <span className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-700">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  {venue.checkin_count} here now
                </span>
              )}
            </div>
          </div>

          {/* ── Primary actions ── */}
          <div className="flex gap-3 mb-5">
            <button
              onClick={handleDirections}
              className="flex-1 bg-gray-900 text-white py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-black transition-colors active:scale-[0.98]"
            >
              <Navigation size={17} />
              Directions
            </button>
            <button
              onClick={handleCheckin}
              disabled={isTogglingCheckin}
              className={`flex-1 py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 border transition-all active:scale-[0.98] disabled:opacity-60 ${
                checkedIn
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {checkedIn ? <CheckCircle2 size={17} /> : <MapPin size={17} />}
              {checkedIn ? 'Checked in' : 'Check in'}
            </button>
          </div>

          {/* ── Detail panels ── */}
          <div className="space-y-3">

            {venue.description && (
              <Panel title="About">
                <p className="text-gray-600 text-sm leading-relaxed">{venue.description}</p>
              </Panel>
            )}

            {venue.amenities.length > 0 && (
              <Panel title="Amenities">
                <div className="flex flex-wrap gap-2">
                  {venue.amenities.map((amenity) => (
                    <span
                      key={amenity}
                      className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-full text-xs font-medium text-gray-600 capitalize"
                    >
                      {amenity.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </Panel>
            )}

            {venue.players_here.length > 0 && (
              <Panel title={`Playing here now · ${venue.players_here.length}`}>
                <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
                  {venue.players_here.map((player) => (
                    <div key={player.user_id} className="flex flex-col items-center gap-1.5 shrink-0">
                      {player.avatar_url ? (
                        <img
                          src={player.avatar_url}
                          alt={player.full_name}
                          className="w-12 h-12 rounded-full object-cover border-2 border-gray-50 shadow-sm"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-100 border-2 border-gray-50 shadow-sm flex items-center justify-center text-gray-500 font-semibold text-lg">
                          {player.full_name[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                      <span className="text-xs font-medium text-gray-600 max-w-[48px] truncate">
                        {player.full_name.split(' ')[0]}
                      </span>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {(venue.contact_phone || venue.contact_website) && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 pt-5 pb-2">
                  <h2 className="text-sm font-semibold text-gray-500">Contact</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {venue.contact_phone && (
                    <a
                      href={`tel:${venue.contact_phone}`}
                      className="flex items-center gap-3 px-5 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Phone size={16} className="text-gray-400 shrink-0" />
                      {venue.contact_phone}
                    </a>
                  )}
                  {venue.contact_website && (
                    <a
                      href={venue.contact_website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-5 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Globe size={16} className="text-gray-400 shrink-0" />
                      {venue.contact_website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Reviews panel */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-500">
                  Reviews{venue.review_count > 0 && <span className="font-normal text-gray-400 ml-1">({venue.review_count})</span>}
                </h2>
                {userId && !userHasReviewed && !showReviewForm && (
                  <button
                    onClick={() => setShowReviewForm(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-gray-900"
                  >
                    <MessageSquare size={14} />
                    Write a review
                  </button>
                )}
              </div>

              {showReviewForm && (
                <div className="mx-5 mb-4 bg-gray-50 border border-gray-200 rounded-2xl p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Your rating</p>
                  <div className="flex items-center gap-2 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setReviewRating(star)}
                        className="transition-transform active:scale-90"
                      >
                        <Star
                          size={28}
                          className={star <= reviewRating ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}
                        />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reviewBody}
                    onChange={(e) => setReviewBody(e.target.value)}
                    placeholder="Share your experience (optional)"
                    maxLength={500}
                    className="w-full bg-white border border-gray-200 rounded-xl p-3.5 text-sm text-gray-700 resize-none focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 mb-3"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowReviewForm(false)}
                      className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-600 border border-gray-200 bg-white hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitReview}
                      disabled={isSubmittingReview}
                      className="flex-1 py-2.5 rounded-xl font-semibold text-sm bg-gray-900 text-white hover:bg-black disabled:opacity-50"
                    >
                      {isSubmittingReview ? 'Submitting…' : 'Submit'}
                    </button>
                  </div>
                </div>
              )}

              {venue.review_count === 0 ? (
                <div className="text-center py-8 px-5 border-t border-gray-100">
                  <Star size={24} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No reviews yet. Be the first!</p>
                </div>
              ) : (
                <>
                  <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-4">
                    <span className="font-display font-bold text-3xl text-gray-900">
                      {venue.average_rating.toFixed(1)}
                    </span>
                    <div>
                      <div className="flex items-center gap-0.5 mb-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            size={13}
                            className={i <= Math.round(venue.average_rating) ? 'fill-yellow-500 text-yellow-500' : 'text-gray-200 fill-gray-200'}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-gray-400">{venue.review_count} reviews</span>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {venue.reviews.slice(0, 5).map((review) => (
                      <div key={review.id} className="px-5 py-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-semibold text-sm text-gray-900">{review.reviewer_name}</span>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <Star
                                key={i}
                                size={11}
                                className={i <= review.rating ? 'fill-yellow-500 text-yellow-500' : 'text-gray-200 fill-gray-200'}
                              />
                            ))}
                          </div>
                        </div>
                        {review.comment && (
                          <p className="text-sm text-gray-600 leading-relaxed">{review.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ── Floating check-in CTA ── */}
      <div className="absolute bottom-0 left-0 w-full bg-white/90 backdrop-blur-md border-t border-gray-100 px-5 pt-3.5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] z-40">
        <button
          onClick={handleCheckin}
          disabled={isTogglingCheckin}
          className={`w-full font-semibold text-base py-3.5 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${
            checkedIn
              ? 'bg-gray-100 text-gray-500 border border-gray-200'
              : 'bg-gray-900 text-white hover:bg-black'
          }`}
        >
          {checkedIn ? (
            <>
              <CheckCircle2 size={18} />
              Check out
            </>
          ) : (
            <>
              <MapPin size={18} />
              Check in here
            </>
          )}
        </button>
      </div>
    </div>
  );
}
