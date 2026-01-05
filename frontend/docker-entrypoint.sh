#!/bin/sh

# Function to replace environment variables in built files
replace_env_vars() {
    echo "Substituting environment variables..."
    
    # Find all JS files in the build output
    find /usr/share/nginx/html -name "*.js" -type f | while read -r file; do
        echo "Processing $file..."
        
        # Replace import.meta.env.VITE_API_URL with actual environment variable
        if [ -n "$VITE_API_URL" ]; then
            # Use a more specific pattern to avoid false matches
            sed -i "s|import\.meta\.env\.VITE_API_URL|\"$VITE_API_URL\"|g" "$file"
        fi
        
        # Also handle the fallback pattern in case it's used
        if [ -n "$VITE_API_URL" ]; then
            sed -i "s|import\.meta\.env\.VITE_API_URL\|\|\"http://localhost:5000\"|\"$VITE_API_URL\"|g" "$file"
        fi
    done
    
    echo "Environment variable substitution completed."
}

# Replace environment variables in the built files
replace_env_vars

# Start nginx
exec "$@"