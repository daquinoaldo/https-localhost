#!/usr/bin/env bash

# capture errors and notify the user
set -e
trap 'if [[ $? -ne 0 ]]; then echo "ERROR: something went wrong."; fi' EXIT

# check the os
case "$(uname -s)" in
    Darwin*)
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
        sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain cert/CA.pem
        echo "Certificate installed."
        ;;
    Linux*)
        echo "Using mkcert on linux."
        sudo apt install -y golang-go libnss3-tools
        go get -u github.com/FiloSottile/mkcert
        PATH=$(go env GOPATH)/bin:$PATH
        mkcert -install
        mkcert -cert-file cert/localhost.crt -key-file cert/localhost.key localhost
        ;;
    *)
        echo "Unsupported system."
        exit 1
        ;;
esac
