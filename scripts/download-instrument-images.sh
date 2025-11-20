#!/bin/bash
# Download Unsplash images for instruments
# Run: bash scripts/download-instrument-images.sh

echo "Downloading instrument images from Unsplash..."

cd "$(dirname "$0")/../images/instruments" || exit

# Flute
curl -o flute.jpg "https://images.unsplash.com/photo-1516280440614-6697288d5d38?auto=format&fit=crop&w=800&q=80"

# Clarinet
curl -o clarinet.jpg "https://images.unsplash.com/photo-1573871666457-7c7329118cf9?auto=format&fit=crop&w=800&q=80"

# Dizi (bamboo)
curl -o dizi.jpg "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=80"

# Soprano Sax
curl -o soprano_sax.jpg "https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=800&q=80"

# Alto Sax
curl -o alto_sax.jpg "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?auto=format&fit=crop&w=800&q=80"

# Trumpet
curl -o trumpet.jpg "https://images.unsplash.com/photo-1573871669414-010dbf73ca84?auto=format&fit=crop&w=800&q=80"

# Trombone
curl -o trombone.jpg "https://images.unsplash.com/photo-1563371738-64473c2c72e6?auto=format&fit=crop&w=800&q=80"

# Suona (festival)
curl -o suona.jpg "https://images.unsplash.com/photo-1515405295579-ba7f9f92f413?auto=format&fit=crop&w=800&q=80"

# Violin
curl -o violin.jpg "https://images.unsplash.com/photo-1612225330812-01a9c6b355ec?auto=format&fit=crop&w=800&q=80"

# Cello
curl -o cello.jpg "https://images.unsplash.com/photo-1465847899078-b290428d3268?auto=format&fit=crop&w=800&q=80"

# Erhu (moon)
curl -o erhu.jpg "https://images.unsplash.com/photo-1528360983277-13d9b1514362?auto=format&fit=crop&w=800&q=80"

# Harmonica
curl -o harmonica.jpg "https://images.unsplash.com/photo-1629803672362-645426953b63?auto=format&fit=crop&w=800&q=80"

echo "✅ Download complete! Images saved to images/instruments/"
echo "Total files: $(ls -1 | wc -l)"
