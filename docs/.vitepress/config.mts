import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "Smokey",
  description: "TODO - Replace with your project description.",
  base: '/Smokey/',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'GitHub', link: 'https://github.com/ScottKirvan/Smokey' }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/ScottKirvan/Smokey' },
      { icon: 'discord', link: 'https://discord.gg/TN6XJSNK5Y' }
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © Scott Kirvan'
    },
    search: {
      provider: 'local'
    }
  }
})
