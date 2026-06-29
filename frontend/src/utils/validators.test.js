import { describe, it, expect } from 'vitest'
import { isValidEmail, isValidCpf, maskCpf, stripCpf } from './validators'

describe('validators · e-mail', () => {
  it('aceita e-mails bem formados', () => {
    expect(isValidEmail('ana@provedor.com')).toBe(true)
    expect(isValidEmail('joao.silva+tag@empresa.com.br')).toBe(true)
  })

  it('rejeita e-mails inválidos', () => {
    expect(isValidEmail('semarroba.com')).toBe(false)
    expect(isValidEmail('sem@dominio')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })

  it('rejeita TLD curto demais e valores nulos', () => {
    expect(isValidEmail('x@y.z')).toBe(false) // TLD "z" tem 1 caractere
    expect(isValidEmail(null)).toBe(false)
  })
})

describe('validators · CPF', () => {
  it('valida CPF com dígitos verificadores corretos', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('52998224725')).toBe(true)
  })

  it('rejeita CPF com dígito verificador errado', () => {
    expect(isValidCpf('529.982.247-20')).toBe(false)
  })

  it('rejeita CPFs de dígitos repetidos e tamanho errado', () => {
    expect(isValidCpf('111.111.111-11')).toBe(false)
    expect(isValidCpf('123')).toBe(false)
  })

  it('maskCpf formata progressivamente', () => {
    expect(maskCpf('52998224725')).toBe('529.982.247-25')
    expect(maskCpf('529982')).toBe('529.982')
  })

  it('stripCpf remove pontuação', () => {
    expect(stripCpf('529.982.247-25')).toBe('52998224725')
  })
})
