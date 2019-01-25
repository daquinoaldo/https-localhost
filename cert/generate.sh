#!/usr/bin/env bash

# capture errors and notify the user
set -e
trap 'if [[ $? -ne 0 ]]; then echo "ERROR: something went wrong."; fi' EXIT

# check the os
case "$(uname -s)" in
    Darwin*) machine=MacOS;;
    Linux*)  machine=Linux
        echo "WARNING: Only Ubuntu is supported. No guarantee for other Linux distributions.";;
    CYGWIN*) machine=Linux
        echo "WARNING: Support for Cygwin not guaranteed. Trying with the Linux script (coming soon).";;
    MINGW*)  machine=Linux
        echo "WARNING: Support for MinGw not guaranteed. Trying with the Linux script (coming soon).";;
    *) echo "Unknown operating system."; exit 1;;
esac

# generate the CA
echo "Creating a certification authority to sign the certificate..."
openssl req -x509 -newkey rsa:4096 -keyout cert/CA.key -out cert/CA.pem -days 1024 -nodes -subj "/C=US/ST=None/L=None/O=None/OU=None/CN=localhost"
echo "Generated CA.key and CA.pem."

# crate the certificate
echo "Creating a certificate for localhost and signing with out CA..."
openssl req -new -sha256 -nodes -out cert/server.csr -newkey rsa:2048 -keyout cert/localhost.key -config cert/server.conf
openssl x509 -req -in cert/server.csr -CAkey cert/CA.key -CA cert/CA.pem -CAcreateserial -out cert/localhost.crt -days 1024 -sha256 -extfile cert/x509.ext
echo "Generated localhost.key and localhost.crt."

# install the CA
echo "Installing the certificate..."
case ${machine} in
    MacOS*)
        sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain cert/CA.pem
        ;;
    Linux*)
        echo "Using mkcert on linux."
        sudo apt install -y golang-go libnss3-tools
        PATH=$(go env GOPATH)/bin:$PATH
        mkcert -install
        mkcert -cert-file cert/localhost.crt -key-file cert/localhost.key localhost
        #sudo cp cert/CA.pem /usr/local/share/ca-certificates/localhost.crt
        #sudo chmod 664 /usr/local/share/ca-certificates/localhost.crt
        #sudo update-ca-certificates
        ;;
    *) exit 1;;
esac
echo "Certificate installed."


