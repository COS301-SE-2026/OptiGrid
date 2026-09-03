# Supabase Auth Configuration Task

To fix the Google Authentication redirect loop on AWS, you need to allow your new AWS domain in your Supabase project settings.

## Steps

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project and navigate to **Authentication** > **URL Configuration** (in the sidebar under Configuration).
3. Under **Site URL**, you can either set this to your primary AWS domain (e.g., `https://your-aws-domain.com`).
4. Under **Redirect URLs**, click **Add URL** and add your AWS domain with a wildcard for the auth callback: 
   - `https://your-aws-domain.com/api/auth/googleAuth` 
   - (Or just `https://your-aws-domain.com/*` if you want to allow any path).

Once this is updated, Supabase will respect the `redirectTo` parameter we send from the app, and Google Auth will redirect to your AWS domain instead of localhost.
