# PALIMPS - iOS App Store Deployment Guide

Complete step-by-step guide to publish PALIMPS to the Apple App Store.

---

## Prerequisites

### 1. Apple Developer Account
- **Cost:** $99/year
- **Sign up:** https://developer.apple.com/programs/enroll/
- **Requirements:**
  - Apple ID
  - Credit card for payment
  - 2-factor authentication enabled
  - Verification may take 24-48 hours

### 2. Expo Account
- **Sign up:** https://expo.dev/signup
- **Free tier** is sufficient for building

### 3. Tools
- **Node.js** (already installed)
- **EAS CLI:** `npm install -g eas-cli`
- **Expo CLI:** `npm install -g expo-cli`

---

## Step 1: Apple Developer Account Setup

### 1.1 Create Apple Developer Account
1. Go to https://developer.apple.com/programs/enroll/
2. Sign in with your Apple ID
3. Complete enrollment form
4. Pay $99 annual fee
5. Wait for approval (24-48 hours)

### 1.2 Get Team ID
1. Log in to https://developer.apple.com/account
2. Go to "Membership"
3. Note your **Team ID** (10-character code)

---

## Step 2: App Store Connect Setup

### 2.1 Create App in App Store Connect
1. Go to https://appstoreconnect.apple.com
2. Click "My Apps" → "+" → "New App"
3. Fill in details:
   - **Platform:** iOS
   - **Name:** PALIMPS
   - **Primary Language:** English (U.S.)
   - **Bundle ID:** Select "space.manus.okuma.hafizasi.mvp.t20260130232125"
     - If not available, create it in Developer Portal first
   - **SKU:** palimps-ios-2026 (unique identifier)
   - **User Access:** Full Access

### 2.2 Get App Store Connect App ID
1. In App Store Connect, open your app
2. Go to "App Information"
3. Note the **Apple ID** (numeric, e.g., 1234567890)

---

## Step 3: Configure EAS Build

### 3.1 Install EAS CLI
```bash
npm install -g eas-cli
```

### 3.2 Login to Expo
```bash
eas login
```

### 3.3 Configure Project
```bash
cd /home/ubuntu/okuma-hafizasi-mvp
eas build:configure
```

### 3.4 Update eas.json
Edit `eas.json` and update the `submit.production.ios` section:

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "1234567890",
        "appleTeamId": "ABCD123456"
      }
    }
  }
}
```

Replace:
- `your-apple-id@example.com` → Your Apple ID email
- `1234567890` → Your App Store Connect App ID
- `ABCD123456` → Your Apple Team ID

---

## Step 4: Build iOS App

### 4.1 Create Production Build
```bash
cd /home/ubuntu/okuma-hafizasi-mvp
eas build --platform ios --profile production
```

This will:
- Upload your code to Expo servers
- Build the iOS app (.ipa file)
- Generate a download link
- Takes 10-20 minutes

### 4.2 Monitor Build Progress
- Check build status at: https://expo.dev/accounts/[your-account]/projects/okuma-hafizasi-mvp/builds
- You'll receive an email when the build completes

---

## Step 5: Submit to App Store

### Option A: Automatic Submission (Recommended)

```bash
eas submit --platform ios --profile production
```

EAS will:
- Download the .ipa file
- Upload to App Store Connect
- Configure TestFlight automatically

### Option B: Manual Submission

1. Download the .ipa file from EAS build page
2. Use **Transporter** app (Mac only):
   - Download from Mac App Store
   - Open Transporter
   - Drag .ipa file
   - Sign in with Apple ID
   - Click "Deliver"

---

## Step 6: Configure App Store Listing

### 6.1 App Information
1. Go to App Store Connect → Your App → "App Information"
2. Fill in:
   - **Subtitle:** Personal Reading Memory System
   - **Category:** Productivity
   - **Secondary Category:** Education (optional)
   - **Content Rights:** No, it does not contain third-party content

### 6.2 Pricing and Availability
1. Go to "Pricing and Availability"
2. Set **Price:** Free
3. **Availability:** All countries
4. **Pre-orders:** No

### 6.3 App Privacy
1. Go to "App Privacy"
2. Click "Get Started"
3. Answer privacy questions:
   - **Do you collect data?** Yes
   - **Data types:**
     - Contact Info (Email Address) - for account creation
     - User Content (Photos, Other User Content) - for reading moments
   - **Usage:** App functionality, analytics
   - **Linked to user:** Yes
   - **Used for tracking:** No

### 6.4 App Store Listing
1. Go to "1.0 Prepare for Submission"
2. Fill in:
   - **App Previews and Screenshots:**
     - Upload 6 screenshots from `/home/ubuntu/okuma-hafizasi-mvp/app-store-screenshots/`
     - Order: 01-login, 03-home, 06-book-detail, 07-add-moment, 04-search, 10-profile
   - **Promotional Text:** (Copy from APP_STORE_METADATA.md)
   - **Description:** (Copy from APP_STORE_METADATA.md)
   - **Keywords:** palimps,reading,books,ocr,notes,reading tracker,book tracker
   - **Support URL:** https://palimps.app/hakkimizda.html
   - **Marketing URL:** https://palimps.app
   - **Version:** 1.0.0
   - **Copyright:** © 2026 PALIMPS. All rights reserved.

### 6.5 App Review Information
1. **Sign-In Required:** Yes
2. **Demo Account:**
   - Username: demo@palimps.app
   - Password: DemoUser2026!
3. **Contact Information:**
   - First Name: [Your Name]
   - Last Name: [Your Last Name]
   - Phone: [Your Phone]
   - Email: support@palimps.app
4. **Notes:** (Copy from APP_STORE_METADATA.md → Review Notes)

### 6.6 Version Release
- **Automatically release:** Recommended
- **Manual release:** If you want to control timing

---

## Step 7: Submit for Review

1. Click "Add for Review"
2. Answer export compliance questions:
   - **Does your app use encryption?** No (we use HTTPS but no custom encryption)
   - If asked, select "No" for ITSAppUsesNonExemptEncryption
3. Click "Submit for Review"

---

## Step 8: Wait for Review

### Review Timeline
- **Average:** 24-48 hours
- **Can be:** 1-7 days

### Review Status
- **Waiting for Review:** In queue
- **In Review:** Being reviewed
- **Pending Developer Release:** Approved, waiting for your release
- **Ready for Sale:** Live on App Store!
- **Rejected:** See rejection reasons and resubmit

### Common Rejection Reasons
1. **Missing demo account** → Already provided
2. **Broken features** → Test thoroughly before submission
3. **Privacy policy missing** → Already added to landing page
4. **Misleading screenshots** → Our screenshots are accurate
5. **Crashes** → Test on real device via TestFlight first

---

## Step 9: TestFlight Beta Testing (Optional but Recommended)

Before submitting for review, test with TestFlight:

### 9.1 Enable TestFlight
1. After build is uploaded, go to "TestFlight" tab in App Store Connect
2. Build will appear automatically
3. Add yourself as internal tester
4. Install TestFlight app on iPhone
5. Accept invitation and test the app

### 9.2 Test Checklist
- [ ] Login with Google/Apple works
- [ ] Add book works
- [ ] Take photo and OCR works
- [ ] Create reading moment works
- [ ] Search works
- [ ] Profile and settings work
- [ ] No crashes or errors

---

## Step 10: Post-Approval

### 10.1 App Goes Live
- You'll receive email notification
- App appears on App Store within 24 hours
- Search for "PALIMPS" on App Store

### 10.2 Monitor
- **Ratings and Reviews:** Respond to user feedback
- **Crash Reports:** Fix bugs in updates
- **Analytics:** Track downloads and usage

### 10.3 Updates
To release updates:
1. Increment version in `app.config.ts` (e.g., 1.0.1)
2. Run `eas build --platform ios --profile production`
3. Submit new build to App Store
4. Fill in "What's New" section
5. Submit for review

---

## Troubleshooting

### Build Fails
- Check error message in EAS build logs
- Common issues:
  - Missing dependencies → Run `pnpm install`
  - TypeScript errors → Run `pnpm check`
  - Invalid credentials → Re-run `eas build:configure`

### Upload Fails
- Check Apple ID credentials
- Verify Team ID is correct
- Ensure Bundle ID matches

### Review Rejection
- Read rejection message carefully
- Fix issues mentioned
- Respond in Resolution Center
- Resubmit

---

## Quick Command Reference

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project
cd /home/ubuntu/okuma-hafizasi-mvp
eas build:configure

# Build for iOS
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios --profile production

# Check build status
eas build:list

# View build logs
eas build:view [BUILD_ID]
```

---

## Resources

- **App Store Connect:** https://appstoreconnect.apple.com
- **Apple Developer:** https://developer.apple.com
- **Expo Documentation:** https://docs.expo.dev/build/introduction/
- **EAS Build:** https://docs.expo.dev/build/setup/
- **EAS Submit:** https://docs.expo.dev/submit/ios/
- **App Store Review Guidelines:** https://developer.apple.com/app-store/review/guidelines/

---

## Checklist

### Before Building
- [ ] Apple Developer account created ($99/year)
- [ ] Expo account created
- [ ] EAS CLI installed
- [ ] Team ID obtained
- [ ] App created in App Store Connect
- [ ] App Store Connect App ID obtained

### Before Submitting
- [ ] eas.json configured with correct IDs
- [ ] Build completed successfully
- [ ] TestFlight testing done (optional)
- [ ] Screenshots uploaded
- [ ] App description filled
- [ ] Privacy policy URL added
- [ ] Demo account credentials provided
- [ ] Review notes written

### After Submission
- [ ] Monitor review status
- [ ] Respond to any questions from Apple
- [ ] Prepare marketing materials
- [ ] Plan launch announcement

---

## Next Steps

1. **Create Apple Developer Account** → https://developer.apple.com/programs/enroll/
2. **Create Expo Account** → https://expo.dev/signup
3. **Follow this guide step by step**
4. **Submit to App Store**
5. **Wait for approval**
6. **Launch! 🚀**

Good luck with your App Store submission!
