CREATE DATABASE IF NOT EXISTS notificaciones;
USE notificaciones;

CREATE TABLE IF NOT EXISTS tipo_plantilla (
    id INT PRIMARY KEY NOT NULL,
    nombre VARCHAR(16) NOT NULL
);


-- Tabla de plantillas de mensajes
CREATE TABLE IF NOT EXISTS plantilla (
    id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    contenido TEXT NOT NULL,
    id_tipo INT NOT NULL,
    FOREIGN KEY (id_tipo) REFERENCES tipo_plantilla(id)
);

-- Tabla de estados de mensaje
CREATE TABLE IF NOT EXISTS estado_msj (
    id INT PRIMARY KEY NOT NULL,
    significado VARCHAR(32) NOT NULL
);


-- Tabla de estados de turno
CREATE TABLE IF NOT EXISTS estado_turno (
    id INT PRIMARY KEY NOT NULL,
    nombre VARCHAR(32) NOT NULL
);

CREATE TABLE IF NOT EXISTS estado_turno_paciente(
    id INT PRIMARY KEY NOT NULL,
    nombre VARCHAR(32) NOT NULL
);


-- Efector
CREATE TABLE IF NOT EXISTS efector (
    id INT PRIMARY KEY NOT NULL,
    nombre VARCHAR(64) NOT NULL
);


CREATE TABLE IF NOT EXISTS servicio (
    id INT PRIMARY KEY NOT NULL,
    nombre VARCHAR(64) NOT NULL
);


CREATE TABLE IF NOT EXISTS especialidad (
    id INT PRIMARY KEY NOT NULL,
    id_servicio INT NOT NULL,
    nombre VARCHAR(64) NOT NULL,
    FOREIGN KEY (id_servicio) REFERENCES servicio(id)
);


CREATE TABLE IF NOT EXISTS efe_ser_esp(
    id INT  PRIMARY KEY NOT NULL,
    id_efector INT NOT NULL,
    id_servicio INT NOT NULL,
    id_especialidad INT NOT NULL,
    FOREIGN KEY (id_efector) REFERENCES efector(id),
    FOREIGN KEY (id_servicio) REFERENCES servicio(id),
    FOREIGN KEY (id_especialidad) REFERENCES especialidad(id)
);


CREATE TABLE IF NOT EXISTS turno(
    id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    id_sisr INT NOT NULL,
    id_paciente INT NOT NULL,
    id_estado INT NOT NULL,
    id_estado_paciente INT NOT NULL,
    msj_confirmado TINYINT NOT NULL,
    msj_reprogramado TINYINT NOT NULL,
    msj_cancelado TINYINT NOT NULL,
    msj_recordatorio TINYINT NOT NULL,
    id_efe_ser_esp INT NOT NULL,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    FOREIGN KEY (id_estado) REFERENCES estado_turno(id),
    FOREIGN KEY (id_efe_ser_esp) REFERENCES efe_ser_esp(id),
    FOREIGN KEY (id_estado_paciente) REFERENCES estado_turno_paciente(id)
);


CREATE TABLE IF NOT EXISTS sesion (
    id VARCHAR(3) PRIMARY KEY NOT NULL,
    numero VARCHAR(16) NOT NULL
);


-- Tabla de mensajes enviados
CREATE TABLE IF NOT EXISTS mensaje (
    id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    id_mensaje VARCHAR(32) NULL,
    id_turno INT NULL,
    numero VARCHAR(16) NULL,
    id_sesion VARCHAR(3) NULL,
    id_plantilla INT NOT NULL,
    fecha_envio DATETIME NOT NULL,
    fecha_last_ack DATETIME NULL,
    id_estado INT NOT NULL,
    FOREIGN KEY (id_turno) REFERENCES turno(id),
    FOREIGN KEY (id_sesion) REFERENCES sesion(id),
    FOREIGN KEY (id_estado) REFERENCES estado_msj(id),
    FOREIGN KEY (id_plantilla) REFERENCES plantilla(id)
);




CREATE TABLE IF NOT EXISTS efe_ser_esp_plantilla(
    id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
    id_efe_ser_esp  INT NOT NULL,
    confirmacion TINYINT NOT NULL,
    plantilla_conf INT NULL,
    reprogramacion TINYINT NOT NULL,
    plantilla_repr INT NULL,
    cancelacion TINYINT NOT NULL,
    plantilla_canc INT NULL,
    recordatorio TINYINT NOT NULL,
    plantilla_reco INT NULL,
    dias_antes INT NULL,
    FOREIGN KEY (id_efe_ser_esp) REFERENCES efe_ser_esp(id),
    FOREIGN KEY (plantilla_conf) REFERENCES plantilla(id),
    FOREIGN KEY (plantilla_repr) REFERENCES plantilla(id),
    FOREIGN KEY (plantilla_canc) REFERENCES plantilla(id),
    FOREIGN KEY (plantilla_reco) REFERENCES plantilla(id)
);



CREATE TABLE IF NOT EXISTS last_mod(
    id INT  AUTO_INCREMENT NOT NULL PRIMARY KEY ,
    fecha DATETIME NOT NULL
);


CREATE TABLE IF NOT EXISTS estado_turno_espera(
    id INT NOT NULL PRIMARY KEY,
    significado VARCHAR(16) NOT NULL
);



CREATE TABLE IF NOT EXISTS estudio_requerido(
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    nombre VARCHAR(32) NOT NULL
);



CREATE TABLE IF NOT EXISTS tipo_nodo (
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    nombre VARCHAR(16)
);


CREATE TABLE IF NOT EXISTS nodo (
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    nombre VARCHAR(24) NOT NULL,
    msg TEXT NULL,
    id_tipo INT NOT NULL,
    id_nodo_sig INT NULL,
    FOREIGN KEY (id_tipo) REFERENCES tipo_nodo(id), 
    FOREIGN KEY (id_nodo_sig) REFERENCES nodo(id)
);


CREATE TABLE IF NOT EXISTS ruta (
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    id_nodo INT NOT NULL,
    nombre_ruta VARCHAR(16) NOT NULL,
    id_nodo_sig INT NOT NULL,
    FOREIGN KEY (id_nodo) REFERENCES nodo(id),
    FOREIGN KEY (id_nodo_sig) REFERENCES nodo(id)
);


CREATE TABLE IF NOT EXISTS plantilla_flow (
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    nombre VARCHAR(24) NOT NULL,
    id_nodo_inicio INT NOT NULL,
    FOREIGN KEY (id_nodo_inicio) REFERENCES nodo(id)
);

CREATE TABLE IF NOT EXISTS estado_flow(
    id  INT NOT NULL PRIMARY KEY,
    nombre VARCHAR(16) NOT NULL
);


CREATE TABLE IF NOT EXISTS flow (
    id VARCHAR(20) NOT NULL PRIMARY KEY,
    id_estado INT NOT NULL,
    id_plantilla_flow INT NOT NULL,
    id_sesion VARCHAR(3) NOT NULL,
    numero VARCHAR(16) NOT NULL,
    fecha_inicio DATETIME NOT NULL, 
    fecha_cierre DATETIME NULL,
    FOREIGN KEY (id_sesion) REFERENCES sesion(id),
    FOREIGN KEY (id_plantilla_flow) REFERENCES plantilla_flow(id),
    FOREIGN KEY (id_estado) REFERENCES estado_flow(id)
);


CREATE TABLE IF NOT EXISTS msg_flow_env (
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    id_flow VARCHAR(20) NOT NULL,
    id_nodo INT NOT NULL,
    fecha_hora DATETIME NOT NULL, 
    FOREIGN KEY (id_flow) REFERENCES flow(id),
    FOREIGN KEY (id_nodo) REFERENCES nodo(id)
);


CREATE TABLE IF NOT EXISTS msg_flow_rec (
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    id_flow VARCHAR(20) NOT NULL,
    msg TEXT NULL,
    fecha_hora DATETIME NOT NULL,
    FOREIGN KEY (id_flow) REFERENCES flow(id)
);


CREATE TABLE IF NOT EXISTS turno_flow (
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    id_turno INT NOT NULL,
    id_flow VARCHAR (20) NOT NULL,
    FOREIGN KEY (id_turno) REFERENCES turno(id),
    FOREIGN KEY (id_flow) REFERENCES flow(id)
);



CREATE TABLE IF NOT EXISTS deriva (
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    id_efector INT NOT NULL,
    id_efe_ser_esp_deriva INT NOT NULL,
    cupo TINYINT NOT NULL,
    FOREIGN KEY (id_efector) REFERENCES efector(id),
    FOREIGN KEY (id_efe_ser_esp_deriva) REFERENCES efe_ser_esp(id)
);