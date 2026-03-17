/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/admin/results/report-card/',
        destination: '/admin/results/report-card',
        permanent: false,
      },
      {
        source: '/admin/results/report-card/:id/',
        destination: '/admin/results/report-card/:id',
        permanent: false,
      },
      {
        source: '/admin/report-card',
        destination: '/admin/results/report-card',
        permanent: true,
      },
      {
        source: '/admin/report-card/:id',
        destination: '/admin/results/report-card/:id',
        permanent: true,
      },
      {
        source: '/admin/report-card/:id/',
        destination: '/admin/results/report-card/:id',
        permanent: true,
      },
      {
        source: '/admin/results/reportcard',
        destination: '/admin/results/report-card',
        permanent: true,
      },
      {
        source: '/admin/results/reportcard/:id',
        destination: '/admin/results/report-card/:id',
        permanent: true,
      },
      {
        source: '/admin/results/reportcard/:id/',
        destination: '/admin/results/report-card/:id',
        permanent: true,
      },
      {
        source: '/admin/students/report-card/:id',
        destination: '/admin/students/:id/report-card',
        permanent: true,
      },
      {
        source: '/teacher/reportcard',
        destination: '/teacher/report-card',
        permanent: true,
      },
      {
        source: '/teacher/report-card/',
        destination: '/teacher/report-card',
        permanent: false,
      },
      {
        source: '/student/report-card',
        destination: '/student/classes',
        permanent: false,
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pidshxohbnzqqjhirgbw.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

module.exports = nextConfig
