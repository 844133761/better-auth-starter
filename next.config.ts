const nextConfig = {
  async redirects() {
    return [
      { source: "/auth/login", destination: "/auth", permanent: false },
      {
        source: "/auth/register",
        destination: "/auth?mode=register",
        permanent: false,
      },
      { source: "/dashboard", destination: "/admin", permanent: false },
    ];
  },
};

export default nextConfig;
