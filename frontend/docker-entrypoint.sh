#!/bin/sh

# Function to replace environment variables in built files
replace_env_vars() {
    echo "Substituting environment variables..."
    echo "VITE_API_URL: $VITE_API_URL"
    
    # Find all JS files in the build output
    find /usr/share/nginx/html -name "*.js" -type f | while read -r file; do
        if [ -f "$file" ]; then
            echo "Processing $file..."
            
            # Replace import.meta.env.VITE_API_URL with actual environment variable
            if [ -n "$VITE_API_URL" ]; then
                # Handle different patterns that might exist
                sed -i "s|import\.meta\.env\.VITE_API_URL||\".*\"|\"$VITE_API_URL\"|g" "$file" 2>/dev/null || true
                sed -i "s|import\.meta\.env\.VITE_API_URL|\"$VITE_API_URL\"|g" "$file" 2>/dev/null || true
            fi
        fi
    done
    
    echo "Environment variable substitution completed."
}

# Replace environment variables in the built files
replace_env_vars

# Start nginx
exec "$@"