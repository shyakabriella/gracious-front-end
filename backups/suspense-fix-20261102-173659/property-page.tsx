export default async function PropertyDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <main><h1>Property Details</h1><p>{slug}</p></main>;
}
