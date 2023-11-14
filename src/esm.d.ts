// define types for HTTP imports

declare module 'https://esm.sh/react@18.2.0' {
  import React from 'react'

  export = React
}

declare module 'https://esm.sh/react@18.2.0/jsx-runtime' {
  export * from 'react/jsx-runtime'
}

declare module 'https://esm.sh/react-dom@18.2.0/client' {
  export * from 'react-dom/client'
}

declare module 'https://esm.sh/styled-components@6.1.1' {
  export { default } from 'styled-components'
  export * from 'styled-components'
}
