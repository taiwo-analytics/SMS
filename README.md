# School Management System

A comprehensive School Management System built with Next.js, Supabase, and TypeScript. Features role-based access control for Admin, Teacher, Student, and Parent users.

## Features

- **Role-Based Access Control**: Distinct roles for Admin, Teacher, Student, and Parent
- **Module Selection Interface**: Beautiful module selection page matching modern ERP design
- **Teacher-Specific Views**: Teachers can only see classes they are assigned to
- **Secure Authentication**: Powered by Supabase Auth
- **Responsive Design**: Modern UI with Tailwind CSS

## Tech Stack

- **Frontend**: Next.js 14 (App Router)
- **Backend**: Supabase (Auth + Database)
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd school-management-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new project at [supabase.com](https://supabase.com)
   - Go to SQL Editor and run the SQL script from `supabase/schema.sql`
   - Copy your project URL and anon key from Settings > API

4. **Configure environment variables**
   - Copy `.env.local.example` to `.env.local`
   - Add your Supabase credentials:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
     SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
     DEV_ADMIN_SECRET=change_me_for_dev
     ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Database Setup

Run the SQL script in `supabase/schema.sql` in your Supabase SQL Editor. This will create:

- `profiles` table (extends auth.users with role information)
- `teachers` table
- `students` table
- `parents` table
- `classes` table
- `class_enrollments` table
- Row Level Security (RLS) policies for data access control

## User Roles

### Admin
- Full system access
- Manage teachers, students, classes
- View all data

### Teacher
- View only classes assigned to them
- Manage students in their classes
- View and manage grades

### Student
- View enrolled classes
- View own grades and assignments
- Limited to own data

### Parent
- View children's information
- View children's grades and attendance
- Limited to linked children's data

## Creating Test Users

After setting up the database, you can create users through Supabase Auth:

1. Go to Authentication > Users in Supabase dashboard
2. Create a new user
3. Update the `profiles` table to set the role:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE id = 'user-id';
   ```
4. Create corresponding records in `teachers`, `students`, or `parents` tables as needed

## Project Structure

```
├── app/
│   ├── admin/          # Admin dashboard pages
│   ├── teacher/        # Teacher pages
│   ├── student/        # Student pages
│   ├── parent/         # Parent pages
│   ├── auth/           # Authentication pages
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Module selection page
│   └── globals.css     # Global styles
├── components/         # Reusable components
├── lib/               # Utility functions
│   ├── supabase/      # Supabase clients
│   └── auth.ts        # Auth helpers
├── types/             # TypeScript types
└── supabase/          # Database schema
```

## Security Features

- Row Level Security (RLS) policies ensure users can only access data they're authorized to see
- Teachers can only view classes assigned to them
- Students can only view their own data
- Parents can only view their children's data
- Admins have full access

## License

MIT
