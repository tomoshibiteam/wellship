# WELLSHIP MVP - Environment Variables Configuration Guide

This file documents all environment variables used in the WELLSHIP MVP application.

## Core Configuration

### Authentication
```env
NEXTAUTH_SECRET=your_secret_here
NEXTAUTH_URL=http://localhost:3000
```

### AI Services
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

## Feature Flags (MVP Configuration)

### Photo Feedback Feature
Controls whether photo capture and AI analysis are enabled in the feedback flow.

```env
WELLSHIP_PHOTO_FEEDBACK_ENABLED=false
```

**MVP Default**: `false` (photos disabled)

When `false`:
- Camera capture UI is hidden
- Photo upload API returns 403
- AI analysis is skipped
- Photos are not saved to database

### AI Provider Selection
Controls which AI provider is used for menu generation.

```env
WELLSHIP_AI_PROVIDER=dify
```

**Options**: `dify` | `gemini`  
**MVP Default**: `dify`

- `dify`: Use Dify Workflow API for menu generation
- `gemini`: Use Google Gemini API directly (fallback)

### Procurement Sourcing Constraints
Controls whether ingredient availability constraints are applied during menu generation.

```env
WELLSHIP_SOURCING_ENABLED=false
```

**MVP Default**: `false`

When `true`:
- Only uses recipes with available ingredients
- Filters recipes based on procurement adjustments

## Dify Configuration

Required when `WELLSHIP_AI_PROVIDER=dify`.

### API Authentication
```env
DIFY_API_KEY=your_dify_api_key_here
```

### Workflow Endpoint
Provide **either** `DIFY_WORKFLOW_URL` or `DIFY_APP_ID`:

```env
DIFY_WORKFLOW_URL=https://api.dify.ai/v1/workflows/run
```

Or:

```env
DIFY_APP_ID=your_dify_app_id_here
```

## Setup Instructions

1. Copy this guide and create your `.env.local` file
2. Fill in all required values
3. For MVP deployment, use these defaults:
   - `WELLSHIP_PHOTO_FEEDBACK_ENABLED=false`
   - `WELLSHIP_AI_PROVIDER=dify`
   - `WELLSHIP_SOURCING_ENABLED=false`

## Development vs Production

### Development
- Use `NEXTAUTH_URL=http://localhost:3000`
- Can use test API keys

### Production
- Set `NEXTAUTH_URL` to your production domain
- Use production API keys
- Ensure `NEXTAUTH_SECRET` is cryptographically secure

## Troubleshooting

If you see warnings about missing environment variables:
1. Check that all required variables are set in `.env.local`
2. Restart the development server after changing `.env.local`
3. Run validation: The server will log warnings on startup if configuration is invalid
