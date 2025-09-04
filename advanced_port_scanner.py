#!/usr/bin/env python3
"""
Advanced Port Scanner - A lightweight, efficient alternative to Nmap/RustScan
Author: AI Assistant
Description: Multi-method port scanner with sequential, threaded, and async scanning
"""

import socket
import threading
import time
import sys
import asyncio
import argparse
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from queue import Queue
from datetime import datetime

class PortScanner:
    """Base port scanner class with common functionality"""

    def __init__(self):
        self.common_ports = {
            21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP', 53: 'DNS',
            80: 'HTTP', 110: 'POP3', 143: 'IMAP', 443: 'HTTPS', 993: 'IMAPS',
            995: 'POP3S', 3389: 'RDP', 5432: 'PostgreSQL', 3306: 'MySQL',
            6379: 'Redis', 8080: 'HTTP-Alt', 8443: 'HTTPS-Alt', 9200: 'Elasticsearch'
        }

        # Common port ranges
        self.port_ranges = {
            'common': [21, 22, 23, 25, 53, 80, 110, 143, 443, 993, 995, 3389, 3306, 5432, 6379, 8080],
            'web': [80, 443, 8080, 8443, 8000, 8888, 9000],
            'database': [3306, 5432, 1433, 1521, 6379, 9200, 27017],
            'top100': list(range(1, 101)),
            'top1000': list(range(1, 1001))
        }

    def resolve_host(self, host):
        """Resolve hostname to IP address"""
        try:
            return socket.gethostbyname(host)
        except socket.gaierror:
            return None

    def scan_port(self, host, port, timeout=1):
        """Basic TCP port scan"""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            result = sock.connect_ex((host, port))
            sock.close()

            if result == 0:
                service = self.common_ports.get(port, 'Unknown')
                return {'port': port, 'status': 'open', 'service': service}
            else:
                return {'port': port, 'status': 'closed', 'service': 'N/A'}
        except Exception as e:
            return {'port': port, 'status': 'error', 'service': 'N/A', 'error': str(e)}

    def banner_grab(self, host, port, timeout=2):
        """Attempt to grab service banner"""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            sock.connect((host, port))

            # Send HTTP request for web services
            if port in [80, 8080, 8000, 8888]:
                sock.send(b"GET / HTTP/1.1\r\nHost: " + host.encode() + b"\r\n\r\n")

            banner = sock.recv(1024).decode('utf-8', errors='ignore').strip()
            sock.close()
            return banner[:200] if banner else None
        except:
            return None

class ThreadedPortScanner(PortScanner):
    """Multi-threaded port scanner using ThreadPoolExecutor"""

    def __init__(self, max_threads=100):
        super().__init__()
        self.max_threads = max_threads
        self.results_lock = threading.Lock()
        self.results = []

    def thread_scan_port(self, host, port, timeout=1, grab_banner=False):
        """Thread-safe port scanning function"""
        result = self.scan_port(host, port, timeout)

        if result['status'] == 'open' and grab_banner:
            banner = self.banner_grab(host, port)
            if banner:
                result['banner'] = banner

        with self.results_lock:
            self.results.append(result)
            if result['status'] == 'open':
                print(f"[+] {host}:{port} ({result['service']}) - OPEN")

    def scan(self, host, ports, timeout=1, grab_banner=False):
        """Multi-threaded port scanning"""
        self.results = []
        start_time = time.time()

        print(f"[*] Starting threaded scan of {host} ({len(ports)} ports)")
        print(f"[*] Max threads: {self.max_threads}, Timeout: {timeout}s")

        with ThreadPoolExecutor(max_workers=self.max_threads) as executor:
            futures = [executor.submit(self.thread_scan_port, host, port, timeout, grab_banner) 
                      for port in ports]

            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as e:
                    print(f"[-] Thread error: {e}")

        duration = time.time() - start_time
        open_results = [r for r in self.results if r['status'] == 'open']

        return {
            'method': 'threaded',
            'host': host,
            'ports_scanned': len(ports),
            'duration': duration,
            'open_ports': len(open_results),
            'results': self.results,
            'performance': len(ports) / duration
        }

class AsyncPortScanner(PortScanner):
    """Asynchronous port scanner for maximum performance"""

    def __init__(self, timeout=1.0, max_concurrent=500):
        super().__init__()
        self.timeout = timeout
        self.max_concurrent = max_concurrent
        self.results = []

    async def async_scan_port(self, semaphore, host, port):
        """Async port scanning function"""
        async with semaphore:
            try:
                future = asyncio.open_connection(host, port)
                reader, writer = await asyncio.wait_for(future, timeout=self.timeout)

                writer.close()
                await writer.wait_closed()

                service = self.common_ports.get(port, 'Unknown')
                result = {'port': port, 'status': 'open', 'service': service}
                self.results.append(result)
                print(f"[+] {host}:{port} ({service}) - OPEN")
                return result

            except (asyncio.TimeoutError, ConnectionRefusedError, OSError):
                return {'port': port, 'status': 'closed', 'service': 'N/A'}
            except Exception as e:
                return {'port': port, 'status': 'error', 'service': 'N/A', 'error': str(e)}

    async def scan(self, host, ports):
        """Async port scanning with concurrency control"""
        self.results = []
        semaphore = asyncio.Semaphore(self.max_concurrent)

        start_time = time.time()
        print(f"[*] Starting async scan of {host} ({len(ports)} ports)")
        print(f"[*] Max concurrent: {self.max_concurrent}, Timeout: {self.timeout}s")

        tasks = [self.async_scan_port(semaphore, host, port) for port in ports]
        await asyncio.gather(*tasks, return_exceptions=True)

        duration = time.time() - start_time
        open_results = [r for r in self.results if r['status'] == 'open']

        return {
            'method': 'async',
            'host': host,
            'ports_scanned': len(ports),
            'duration': duration,
            'open_ports': len(open_results),
            'results': self.results,
            'performance': len(ports) / duration
        }

class PortScannerCLI:
    """Command-line interface for the port scanner"""

    def __init__(self):
        self.base_scanner = PortScanner()
        self.threaded_scanner = ThreadedPortScanner()
        self.async_scanner = AsyncPortScanner()

    def parse_ports(self, port_input):
        """Parse port input (ranges, lists, presets)"""
        if port_input in self.base_scanner.port_ranges:
            return self.base_scanner.port_ranges[port_input]

        ports = []
        for part in port_input.split(','):
            if '-' in part:
                start, end = map(int, part.split('-', 1))
                ports.extend(range(start, end + 1))
            else:
                ports.append(int(part))
        return sorted(set(ports))

    def scan_host(self, host, ports, method='threaded', timeout=1, max_workers=100):
        """Perform port scan using specified method"""
        # Resolve hostname
        ip = self.base_scanner.resolve_host(host)
        if not ip:
            print(f"[-] Could not resolve hostname: {host}")
            return None

        if ip != host:
            print(f"[*] Resolved {host} to {ip}")

        # Perform scan based on method
        if method == 'threaded':
            self.threaded_scanner.max_threads = max_workers
            return self.threaded_scanner.scan(ip, ports, timeout)
        elif method == 'async':
            self.async_scanner.max_concurrent = max_workers
            return asyncio.run(self.async_scanner.scan(ip, ports))
        else:
            print(f"[-] Unknown method: {method}")
            return None

    def print_results(self, results):
        """Print scan results in formatted output"""
        if not results:
            return

        print("\n" + "="*60)
        print(f"SCAN RESULTS FOR {results['host']}")
        print("="*60)
        print(f"Method: {results['method']}")
        print(f"Ports Scanned: {results['ports_scanned']}")
        print(f"Duration: {results['duration']:.2f} seconds")
        print(f"Performance: {results['performance']:.1f} ports/second")
        print(f"Open Ports: {results['open_ports']}")

        if results['open_ports'] > 0:
            print("\nOPEN PORTS:")
            print("-" * 30)
            open_results = [r for r in results['results'] if r['status'] == 'open']
            for result in sorted(open_results, key=lambda x: x['port']):
                banner = result.get('banner', '')
                banner_text = f" - {banner[:50]}..." if banner else ""
                print(f"{result['port']:>5}/tcp - {result['service']}{banner_text}")

        print("="*60)

def main():
    """Main function with argument parsing"""
    parser = argparse.ArgumentParser(
        description='Advanced Port Scanner - Lightweight alternative to Nmap',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 advanced_port_scanner.py 192.168.1.1 -p common
  python3 advanced_port_scanner.py example.com -p 1-1000 -m async -t 100
  python3 advanced_port_scanner.py 10.0.0.1 -p 80,443,8080 -m threaded -w 50
        """
    )

    parser.add_argument('host', help='Target hostname or IP address')
    parser.add_argument('-p', '--ports', default='common',
                       help='Ports to scan (common, web, database, top100, top1000, 1-65535, or 80,443,8080)')
    parser.add_argument('-m', '--method', choices=['threaded', 'async'], default='threaded',
                       help='Scanning method (default: threaded)')
    parser.add_argument('-t', '--timeout', type=float, default=1.0,
                       help='Connection timeout in seconds (default: 1.0)')
    parser.add_argument('-w', '--workers', type=int, default=100,
                       help='Max threads/concurrent connections (default: 100)')
    parser.add_argument('--banner', action='store_true',
                       help='Attempt banner grabbing on open ports')
    parser.add_argument('-o', '--output', help='Save results to JSON file')

    args = parser.parse_args()

    # Create CLI instance
    cli = PortScannerCLI()

    try:
        # Parse ports
        ports = cli.parse_ports(args.ports)
        print(f"[*] Target: {args.host}")
        print(f"[*] Ports: {len(ports)} ports")
        print(f"[*] Method: {args.method}")

        # Perform scan
        start_time = datetime.now()
        results = cli.scan_host(args.host, ports, args.method, args.timeout, args.workers)

        if results:
            # Print results
            cli.print_results(results)

            # Save to file if requested
            if args.output:
                results['scan_time'] = start_time.isoformat()
                with open(args.output, 'w') as f:
                    json.dump(results, f, indent=2)
                print(f"[*] Results saved to {args.output}")

    except KeyboardInterrupt:
        print("\n[-] Scan interrupted by user")
    except Exception as e:
        print(f"[-] Error: {e}")

if __name__ == '__main__':
    main()
