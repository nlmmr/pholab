# PhOLab — Laboratório Virtual de Física Olímpica

> Simulador 3D interativo de alta precisão para experimentos de olimpíadas internacionais de física (IPhO, APhO, EuPhO) com incertezas experimentais e ruídos realistas.

---

## 🎯 Sobre o Projeto

O **PhOLab** é uma plataforma aberta que simula com rigor físico o ambiente de uma prova experimental de física:
- **Óptica Ondulatória**: Difração de Fraunhofer em fenda simples, fenda dupla de Young, redes de difração de alta densidade e disco de Airy em tempo real.
- **Polarização por Matrizes de Jones**: Lei de Malus com razão de extinção finita e dispersão.
- **Incertezas Experimentais Realistas**: Ruído quântico de fotodiodo (Poisson/Shot noise), ruído térmico Johnson-Nyquist, instabilidade de emissão laser (RIN), histerese mecânica e erro de leitura vernier.
- **Instrumentação 3D Real**: Fotômetro de bancada digital com display LCD, cabo coaxial BNC flexível dinâmico, estágio micrométrico transversal ($0.01\text{ mm}$) e caderno de prova com o enunciado da IPhO.

---

## 🛠️ Tecnologias Utilizadas

- **React 18**
- **Three.js / React Three Fiber**
- **TypeScript**
- **Vite**

---

## 🚀 Como Rodar Localmente

```bash
# 1. Clonar o repositório
git clone https://github.com/nlmmr/pholab.git

# 2. Entrar na pasta
cd pholab

# 3. Instalar dependências
npm install

# 4. Iniciar o servidor local
npm run dev
```

Abra `http://127.0.0.1:3000` no seu navegador.

---

## 📄 Licença

Distribuído sob a licença MIT. Aberto para estudantes, professores e entusiastas de física olímpica em todo o mundo.
