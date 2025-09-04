#!/bin/bash

# Advanced Port Scanner - Bash Wrapper Script
# Provides easy-to-use interface for the Python port scanner

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCANNER="$SCRIPT_DIR/advanced_port_scanner.py"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to display banner
show_banner() {
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    Advanced Port Scanner                     ║"
    echo "║              Lightweight Alternative to Nmap                 ║"
    echo "║                                                              ║"
    echo "║  Features: Multi-threading, Async scanning, Banner grabbing ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS] TARGET"
    echo ""
    echo "OPTIONS:"
    echo "  -p, --ports PORTS     Port specification (common, web, database, top100, top1000, 1-65535, or 80,443,8080)"
    echo "  -m, --method METHOD   Scanning method (threaded, async) [default: threaded]"
    echo "  -t, --timeout SECONDS Connection timeout [default: 1.0]"
    echo "  -w, --workers NUM     Max threads/concurrent connections [default: 100]"
    echo "  -o, --output FILE     Save results to JSON file"
    echo "  -b, --banner          Enable banner grabbing"
    echo "  -q, --quick           Quick scan (common ports, fast timeout)"
    echo "  -f, --full            Full scan (all 65535 ports)"
    echo "  -h, --help            Show this help message"
    echo ""
    echo "PRESETS:"
    echo "  common                Most common 16 ports"
    echo "  web                   Web service ports (80, 443, 8080, etc.)"
    echo "  database              Database ports (3306, 5432, 6379, etc.)"
    echo "  top100                Top 100 ports (1-100)"
    echo "  top1000               Top 1000 ports (1-1000)"
    echo ""
    echo "EXAMPLES:"
    echo "  $0 192.168.1.1                          # Scan common ports"
    echo "  $0 example.com -p web -m async          # Async scan of web ports"
    echo "  $0 10.0.0.1 -p 1-1000 -w 200 -t 0.5    # Fast scan with 200 workers"
    echo "  $0 target.com --quick                    # Quick scan preset"
    echo "  $0 server.local --full -o results.json  # Full scan with JSON output"
}

# Function to check dependencies
check_dependencies() {
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is required but not installed"
        exit 1
    fi

    if [ ! -f "$PYTHON_SCANNER" ]; then
        print_error "Python scanner script not found: $PYTHON_SCANNER"
        exit 1
    fi
}

# Function to validate IP/hostname
validate_target() {
    local target="$1"

    # Check if it's a valid IP address
    if [[ $target =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        return 0
    fi

    # Check if it's a valid hostname (basic check)
    if [[ $target =~ ^[a-zA-Z0-9.-]+$ ]]; then
        return 0
    fi

    return 1
}

# Function to run port scan with progress
run_scan() {
    local target="$1"
    shift
    local args=("$@")

    print_info "Starting port scan of $target"
    print_info "Arguments: ${args[*]}"

    # Run the Python scanner
    python3 "$PYTHON_SCANNER" "$target" "${args[@]}"
    local exit_code=$?

    if [ $exit_code -eq 0 ]; then
        print_success "Scan completed successfully"
    else
        print_error "Scan failed with exit code $exit_code"
    fi

    return $exit_code
}

# Parse command line arguments
ARGS=()
TARGET=""
QUICK_SCAN=false
FULL_SCAN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_banner
            show_usage
            exit 0
            ;;
        -q|--quick)
            QUICK_SCAN=true
            shift
            ;;
        -f|--full)
            FULL_SCAN=true
            shift
            ;;
        -p|--ports)
            ARGS+=("-p" "$2")
            shift 2
            ;;
        -m|--method)
            ARGS+=("-m" "$2")
            shift 2
            ;;
        -t|--timeout)
            ARGS+=("-t" "$2")
            shift 2
            ;;
        -w|--workers)
            ARGS+=("-w" "$2")
            shift 2
            ;;
        -o|--output)
            ARGS+=("-o" "$2")
            shift 2
            ;;
        -b|--banner)
            ARGS+=("--banner")
            shift
            ;;
        -*)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
        *)
            if [ -z "$TARGET" ]; then
                TARGET="$1"
            else
                print_error "Multiple targets specified. Only one target allowed."
                exit 1
            fi
            shift
            ;;
    esac
done

# Main execution
main() {
    show_banner

    # Check dependencies
    check_dependencies

    # Validate target
    if [ -z "$TARGET" ]; then
        print_error "No target specified"
        show_usage
        exit 1
    fi

    if ! validate_target "$TARGET"; then
        print_error "Invalid target format: $TARGET"
        exit 1
    fi

    # Apply presets
    if [ "$QUICK_SCAN" = true ]; then
        print_info "Applying quick scan preset"
        ARGS+=("-p" "common" "-t" "0.5" "-w" "50")
    elif [ "$FULL_SCAN" = true ]; then
        print_info "Applying full scan preset"
        ARGS+=("-p" "1-65535" "-m" "async" "-w" "1000")
    fi

    # Run the scan
    run_scan "$TARGET" "${ARGS[@]}"
}

# Run main function
main "$@"
