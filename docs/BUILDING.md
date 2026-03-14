# Building Mogwser

This document covers how to build Mogwser from source on Linux, macOS, and Windows.

## Prerequisites

All platforms require the following tools installed before building:

- **Node.js** >= 21.0.0 (with npm)
- **Python** 3.11 or later
- **Rust** (latest stable, installed via rustup)
- **sccache** (Mozilla's shared compilation cache)
- **Git**

### Platform-Specific Prerequisites

#### Linux (x86_64)

Install the required system packages (Debian/Ubuntu):

```bash
sudo apt update
sudo apt install build-essential libgtk-3-dev libdbus-glib-1-dev \
  libxt-dev nasm yasm m4 pkg-config clang lld
```

For Fedora/RHEL:

```bash
sudo dnf install gcc-c++ gtk3-devel dbus-glib-devel libXt-devel \
  nasm yasm m4 clang lld
```

#### macOS (x86_64 and aarch64)

Install Xcode command line tools and Homebrew dependencies:

```bash
xcode-select --install
brew install mercurial yasm nasm watchman
```

Both Intel (x86_64) and Apple Silicon (aarch64) are supported. The build system selects the correct mozconfig based on your target architecture.

#### Windows (x86_64)

1. Install [Visual Studio 2022](https://visualstudio.microsoft.com/) with the "Desktop development with C++" workload.
2. Install [MozillaBuild](https://ftp.mozilla.org/pub/mozilla/libraries/win32/MozillaBuildSetup-Latest.exe), which provides a Unix-like shell environment for building Firefox-based projects.
3. Run all build commands from the MozillaBuild shell (`start-shell.bat`).

## Step-by-Step Build Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/mogwser/mogwser.git
cd mogwser
```

### 2. Install Node.js Dependencies

```bash
npm ci
```

This installs the Gluon build tool and other development dependencies.

### 3. Copy the Mozconfig for Your Platform

Select the mozconfig that matches your build target:

```bash
# Linux
cp mozconfigs/linux-x86_64 engine/mozconfig

# macOS Intel
cp mozconfigs/macos-x86_64 engine/mozconfig

# macOS Apple Silicon
cp mozconfigs/macos-aarch64 engine/mozconfig

# Windows
cp mozconfigs/windows-x86_64 engine/mozconfig
```

### 4. Download and Bootstrap Firefox Source

This downloads the Firefox ESR 128.0 source code and sets up the build environment:

```bash
npm run init
```

This step takes significant time on the first run (downloading several GB of source code). Subsequent runs are faster because already-downloaded files are cached.

### 5. Build Mogwser

```bash
npm run build
```

A full build takes 30 minutes to several hours depending on hardware. The `sccache` integration caches compiled objects to speed up subsequent builds.

To rebuild only the UI layer (after modifying chrome files, JS, CSS, or XUL):

```bash
npm run build:ui
```

### 6. Run Mogwser

```bash
npm run start
```

This launches the locally built Mogwser browser.

### 7. Run Tests

```bash
npm test
```

This runs the Mogwser-specific test suite located in `engine/testing/mogwser/`.

### 8. Package for Distribution

```bash
npm run package
```

Packaged artifacts are written to `engine/obj-*/dist/`.

## Working with Source Patches

Mogwser uses Gluon to manage patches against the Firefox source tree.

- **Import patches** into the source tree: `npm run import`
- **Export changes** back to patch files: `npm run export`

Patches are stored in the `patches/` directory.

## Troubleshooting

### Build fails with "command not found: sccache"

Install sccache via cargo:

```bash
cargo install sccache
```

Ensure `~/.cargo/bin` is in your `PATH`.

### Node.js version too old

Mogwser requires Node.js 21 or later. Check your version:

```bash
node --version
```

Use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) to install a compatible version:

```bash
nvm install 21
nvm use 21
```

### Build fails with out-of-memory errors

Firefox builds require significant RAM. Ensure at least 8 GB of available memory. On Linux, you can add swap space:

```bash
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### macOS: "No matching SDK found"

Ensure Xcode command line tools are installed and up to date:

```bash
xcode-select --install
sudo xcode-select --switch /Applications/Xcode.app
```

### Windows: Build errors in MozillaBuild shell

Make sure you are running commands from the MozillaBuild shell (`start-shell.bat`), not from PowerShell or cmd.exe directly. The MozillaBuild environment sets up required paths and environment variables.

### Rust compilation errors

Ensure your Rust toolchain is up to date:

```bash
rustup update stable
```

### UI-only rebuild does not reflect changes

If UI changes are not appearing after `npm run build:ui`, try a full rebuild:

```bash
npm run build
```

Some changes to XHTML or module structure require a full rebuild to take effect.

### LTO build is too slow

Link-Time Optimization (LTO) is enabled by default for release-quality builds. For faster development builds, edit your platform's mozconfig and change:

```
ac_add_options --enable-lto=full
```

to:

```
ac_add_options --disable-lto
```

This significantly reduces build time at the cost of runtime performance.
