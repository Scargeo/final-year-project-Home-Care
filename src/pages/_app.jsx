export default function App(props) {
  const PageComponent = props.Component
  return <PageComponent {...props.pageProps} />
}
