/* Migrado de app/src/test/.../ValidacionDuenoTest.kt. */
import { ValidacionDueno } from "../../src/data/validacionDueno";

test("dni_aceptaSieteOOchoNumeros", () => {
  expect(ValidacionDueno.dni("30111222")).toBeNull();
  expect(ValidacionDueno.dni(" 9876543 ")).toBeNull();
  expect(ValidacionDueno.dni("123456")).not.toBeNull();
  expect(ValidacionDueno.dni("30.111.222")).not.toBeNull();
  expect(ValidacionDueno.dni("")).not.toBeNull();
});

test("correo_pideArrobaYDominio", () => {
  expect(ValidacionDueno.correo("carlos@prueba.test")).toBeNull();
  expect(ValidacionDueno.correo("carlos@prueba")).not.toBeNull();
  expect(ValidacionDueno.correo("carlos prueba.test")).not.toBeNull();
  expect(ValidacionDueno.correo("")).not.toBeNull();
});

test("telefono_pideAlMenosSeisNumeros", () => {
  expect(ValidacionDueno.telefono("11 4444-3333")).toBeNull();
  expect(ValidacionDueno.telefono("12345")).not.toBeNull();
  expect(ValidacionDueno.telefono("Sin datos")).not.toBeNull();
});

test("nombre_noPuedeEstarVacio", () => {
  expect(ValidacionDueno.nombre("Carlos Gómez")).toBeNull();
  expect(ValidacionDueno.nombre(" ")).not.toBeNull();
});
