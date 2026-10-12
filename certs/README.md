# Certificados SSL

Coloca aquí los archivos del certificado (no se suben a git ni se copian a la imagen;
docker-compose los monta en el contenedor en `/etc/nginx/certs`):

- `star_rodall_com_fullchain.crt` → certificado + intermedio RapidSSL TLS RSA CA G1 (el que usa nginx)
- `star_rodall_com.crt`        → certificado solo (sin intermedio; los teléfonos Android lo rechazan)
- `star_rodall_com_sin_clave.key` → llave privada SIN contraseña (la que usa nginx)

`star_rodall_com.key` (con contraseña) no se usa: nginx no puede pedir la contraseña al arrancar.

Para regenerar el fullchain al renovar el certificado:

    curl -s http://cacerts.rapidssl.com/RapidSSLTLSRSACAG1.crt | openssl x509 -inform DER > intermedio.pem
    cat star_rodall_com.crt intermedio.pem > star_rodall_com_fullchain.crt
