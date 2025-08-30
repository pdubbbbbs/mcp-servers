#!/bin/bash

# MCP Servers Deployment Script
# Deploys all 5 MCP servers to Cloudflare Workers
# Author: Philip S Wright

set -e

echo "🚀 Deploying MCP Servers Collection to Cloudflare Workers"
echo "==========================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# List of servers to deploy
SERVERS=(
    "github-mcp"
    "puppeteer-mcp" 
    "figma-mcp"
    "sentry-mcp"
    "contact7-mcp"
)

# Function to deploy a single server
deploy_server() {
    local server=$1
    echo -e "\n${BLUE}📦 Deploying ${server}...${NC}"
    
    if [ ! -d "$server" ]; then
        echo -e "${RED}❌ Directory $server not found!${NC}"
        return 1
    fi
    
    cd "$server"
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        echo -e "${RED}❌ package.json not found in $server!${NC}"
        cd ..
        return 1
    fi
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}📦 Installing dependencies...${NC}"
        npm install
    fi
    
    # Build the project
    echo -e "${YELLOW}🔨 Building...${NC}"
    npm run build
    
    # Deploy to Cloudflare Workers
    echo -e "${YELLOW}☁️ Deploying to Cloudflare Workers...${NC}"
    npm run deploy
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ ${server} deployed successfully!${NC}"
    else
        echo -e "${RED}❌ ${server} deployment failed!${NC}"
        cd ..
        return 1
    fi
    
    cd ..
}

# Main deployment process
echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found. Please install it first:${NC}"
    echo "npm install -g wrangler"
    exit 1
fi

# Check if logged into Cloudflare
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️ Not logged into Cloudflare. Please login:${NC}"
    echo "wrangler login"
    wrangler login
fi

echo -e "${GREEN}✅ Prerequisites check passed!${NC}"

# Deploy each server
SUCCESS_COUNT=0
FAILED_SERVERS=()

for server in "${SERVERS[@]}"; do
    if deploy_server "$server"; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        FAILED_SERVERS+=("$server")
    fi
done

# Summary
echo -e "\n${BLUE}📊 Deployment Summary${NC}"
echo "====================="
echo -e "${GREEN}✅ Successfully deployed: $SUCCESS_COUNT/${#SERVERS[@]} servers${NC}"

if [ ${#FAILED_SERVERS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Failed deployments:${NC}"
    for failed in "${FAILED_SERVERS[@]}"; do
        echo -e "   - ${RED}$failed${NC}"
    done
fi

# Generate Warp configuration
echo -e "\n${BLUE}⚙️ Generating Warp MCP Configuration...${NC}"

cat > deploy/warp-mcp-config.json << EOF
{
  "name": "MCP Servers Collection",
  "description": "Complete collection of MCP servers for Warp AI Terminal",
  "author": "Philip S Wright",
  "version": "1.0.0",
  "servers": {
    "github": {
      "name": "GitHub MCP Server",
      "url": "https://github-mcp-server.your-subdomain.workers.dev/mcp",
      "description": "GitHub repository management, issues, and PRs",
      "tools": ["list_repositories", "create_issue", "create_pull_request", "search_repositories"]
    },
    "puppeteer": {
      "name": "Puppeteer MCP Server", 
      "url": "https://puppeteer-mcp-server.your-subdomain.workers.dev/mcp",
      "description": "Web scraping, screenshots, and browser automation",
      "tools": ["take_screenshot", "scrape_data", "generate_pdf", "extract_text"]
    },
    "figma": {
      "name": "Figma MCP Server",
      "url": "https://figma-mcp-server.your-subdomain.workers.dev/mcp", 
      "description": "Design file operations and component management",
      "tools": ["get_file", "list_components", "export_assets"]
    },
    "sentry": {
      "name": "Sentry MCP Server",
      "url": "https://sentry-mcp-server.your-subdomain.workers.dev/mcp",
      "description": "Error tracking and performance monitoring", 
      "tools": ["list_errors", "get_performance_metrics", "create_release"]
    },
    "contact7": {
      "name": "Contact7 MCP Server",
      "url": "https://contact7-mcp-server.your-subdomain.workers.dev/mcp",
      "description": "WordPress Contact Form 7 integration",
      "tools": ["list_forms", "get_submissions", "export_data"]
    }
  },
  "setup_instructions": [
    "1. Replace 'your-subdomain' with your actual Cloudflare Workers subdomain",
    "2. Set up required API keys as Cloudflare Worker secrets:",
    "   - wrangler secret put GITHUB_TOKEN",
    "   - wrangler secret put FIGMA_TOKEN", 
    "   - wrangler secret put SENTRY_TOKEN",
    "3. Add the server URLs to your Warp MCP configuration",
    "4. Restart Warp to load the new servers"
  ]
}
EOF

echo -e "${GREEN}✅ Warp configuration saved to deploy/warp-mcp-config.json${NC}"

if [ $SUCCESS_COUNT -eq ${#SERVERS[@]} ]; then
    echo -e "\n${GREEN}🎉 All MCP servers deployed successfully!${NC}"
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Update the URLs in deploy/warp-mcp-config.json with your actual Worker URLs"
    echo "2. Set up API keys using 'wrangler secret put <SECRET_NAME>'"
    echo "3. Configure Warp to use your new MCP servers"
    echo -e "\n${BLUE}Your MCP servers are now globally accessible! 🌍${NC}"
    exit 0
else
    echo -e "\n${YELLOW}⚠️ Some deployments failed. Please check the errors above.${NC}"
    exit 1
fi
