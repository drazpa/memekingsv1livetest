# Featured Spot Purchase System

## Overview
Users can now pay 1 XRP per hour to feature their tokens in one of the 3 premium featured spots on the Dashboard.

## How It Works

### 1. Database Schema
- **Table**: `featured_spot_purchases`
- Tracks all featured spot purchases with:
  - Token ID
  - Wallet address of buyer
  - Spot position (1, 2, or 3)
  - Hours purchased
  - XRP amount paid
  - Transaction hash
  - Start and expiration timestamps
  - Active status

### 2. Pricing
- **Rate**: 1 XRP per hour
- **Maximum Duration**: 168 hours (7 days)
- Payment goes to: `rKxBBMmY969Ph1y63ddVfYyN7xmxwDfVq6`

### 3. User Flow
1. User clicks "⭐ Get Featured" button next to "🔥 Top 3 Featured" heading
2. Selects a token from their collection
3. Chooses which spot (1, 2, or 3) they want
4. Selects how many hours to feature (1-168)
5. Pays the total XRP amount
6. Token appears in the selected featured spot for the duration

### 4. Spot Management
- Only one token can occupy a spot at a time
- Spots show real-time availability
- Occupied spots display time remaining
- Expired purchases are automatically deactivated
- System prevents double-booking of spots

### 5. Features
- Real-time spot availability checking
- Time remaining display for occupied spots
- Full purchase history tracking
- Transaction hash recording for transparency
- Automatic expiration handling

## Files Created/Modified

### New Files:
- `src/utils/featuredSpotPurchase.js` - Payment and purchase logic
- `src/components/FeaturedSpotModal.jsx` - Purchase interface
- `src/components/TokenSelectionModal.jsx` - Token selection UI
- `supabase/migrations/create_featured_spot_payments.sql` - Database schema

### Modified Files:
- `src/pages/Dashboard.jsx` - Added "Get Featured" button and modals

## Security
- Row Level Security (RLS) enabled
- All purchases are transparent and viewable
- Transaction hashes recorded for verification
- Wallet authentication required

## Future Enhancements
- Price discounts for bulk hour purchases
- Notification when spot is about to expire
- Automated renewal option
- Spot reservation/queue system
