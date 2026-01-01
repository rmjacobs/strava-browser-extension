#!/bin/bash

# Create simple but professional-looking icons using ImageMagick
# Using Strava's orange color and a bicycle/activity theme

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "ImageMagick not found. Installing via brew..."
    brew install imagemagick
fi

# Colors
BG_COLOR="#fc4c02"  # Strava orange
TEXT_COLOR="#ffffff"  # White

# Create icon16.png - Simple "S" for Strava
convert -size 16x16 xc:"$BG_COLOR" \
    -gravity center \
    -font "Helvetica-Bold" \
    -pointsize 12 \
    -fill "$TEXT_COLOR" \
    -annotate +0+0 "S" \
    icon16.png

# Create icon48.png - Larger "S"
convert -size 48x48 xc:"$BG_COLOR" \
    -gravity center \
    -font "Helvetica-Bold" \
    -pointsize 36 \
    -fill "$TEXT_COLOR" \
    -annotate +0+0 "S" \
    icon48.png

# Create icon128.png - Largest with gradient
convert -size 128x128 \
    -define gradient:angle=135 \
    gradient:"#fc4c02"-"#ff6b35" \
    -gravity center \
    -font "Helvetica-Bold" \
    -pointsize 96 \
    -fill "$TEXT_COLOR" \
    -annotate +0+0 "S" \
    icon128.png

echo "✅ Icons created successfully!"
ls -lh icon*.png
