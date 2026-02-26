# Supabase Setup Guide

Follow these steps to connect your Supabase project:

## Step 1: Get Your Supabase Credentials

1. **Go to your Supabase Dashboard**
   - Visit [https://supabase.com](https://supabase.com)
   - Sign in or create an account

2. **Create a New Project** (if you haven't already)
   - Click "New Project"
   - Enter project name and database password
   - Choose a region close to you
   - Wait for the project to be created (takes 1-2 minutes)

3. **Get Your Project URL and API Key**
   - In your project dashboard, go to **Settings** (gear icon in the sidebar)
   - Click on **API** in the settings menu
   - You'll see:
     - **Project URL** - Copy this value
     - **Project API keys** section:
       - **anon/public** key - Copy this value (this is what we need)

## Step 2: Update Your .env.local File

1. Open the `.env.local` file in the root of your project
2. Replace the placeholder values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
DEV_ADMIN_SECRET=change_me_for_dev
```

**Example:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzODk2NzI4MCwiZXhwIjoxOTU0NTQzMjgwfQ.example
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
DEV_ADMIN_SECRET=change_me_for_dev
```

## Step 3: Set Up Your Database Schema

1. **Open SQL Editor**
   - In your Supabase dashboard, click on **SQL Editor** in the sidebar

2. **Run the Schema Script**
   - Open the file `supabase/schema.sql` from this project
   - Copy the entire contents
   - Paste it into the SQL Editor
   - Click **Run** (or press Ctrl+Enter)

   This will create:
   - All necessary tables (profiles, teachers, students, parents, classes, etc.)
   - Row Level Security (RLS) policies
   - Triggers for automatic profile creation

## Step 4: Verify Connection

1. **Restart your development server**
   ```bash
   npm run dev
   ```

2. **Test the connection**
   - Navigate to `http://localhost:3000`
   - You should be redirected to `/auth/login` if not authenticated
   - The app should connect to Supabase without errors

## Step 5: Create Your First User

### Option A: Through Supabase Dashboard
1. Go to **Authentication** > **Users** in Supabase
2. Click **Add User** > **Create New User**
3. Enter email and password
4. After creating, update the profile role:

```sql
-- Update the user's role (replace 'user-id' with actual user ID)
UPDATE profiles 
SET role = 'admin' 
WHERE id = 'user-id-from-auth-users-table';
```

### Option B: Through the App
1. You can create users through the login page (if you add a signup feature)
2. Then update their role in the database

## Step 6: Create Role-Specific Records

After creating a user and setting their role, create the corresponding record:

### For Teachers:
```sql
INSERT INTO teachers (user_id, full_name)
VALUES ('user-id', 'Teacher Name');
```

### For Students:
```sql
-- First create/get a parent_id, then:
INSERT INTO students (user_id, parent_id, full_name)
VALUES ('user-id', 'parent-id', 'Student Name');
```

### For Parents:
```sql
INSERT INTO parents (user_id, full_name)
VALUES ('user-id', 'Parent Name');
```

## Troubleshooting

### Connection Errors
- Make sure your `.env.local` file has the correct values
- Restart your dev server after updating `.env.local`
- Check that your Supabase project is active (not paused)

### Authentication Errors
- Verify RLS policies are set up correctly
- Check that the `profiles` table exists and has data
- Ensure the trigger for creating profiles is active

### Database Errors
- Make sure you ran the entire `schema.sql` script
- Check the SQL Editor for any error messages
- Verify all tables were created successfully

## Need Help?

- Check Supabase docs: https://supabase.com/docs
- Check Next.js docs: https://nextjs.org/docs
