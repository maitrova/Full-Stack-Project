#!/bin/sh

# Function to replace environment variables in built files
replace_env_vars() {
    # Find all JS files in the build output
    find /usr/share/nginx/html -name "*.js" -type f | while read -r file; do
        echo "Processing $file for environment variable substitution..."
        
        # Replace VITE_API_URL placeholder with actual environment variable
        if [ -n "$VITE_API_URL" ]; then
            sed -i "s|VITE_API_URL_PLACEHOLDER|$VITE_API_URL|g" "$file"
        fi
        
        # Add more environment variables here as needed
        # Example for other variables:
        # if [ -n "$VITE_OTHER_VAR" ]; then
        #     sed -i "s|VITE_OTHER_VAR_PLACEHOLDER|$VITE_OTHER_VAR|g" "$file"
        # fi
    done
}

# Replace environment variables in the built files
replace_env_vars

# Start nginx
exec "$@"