import { Box, Input, Button, Label } from 'theme-ui'
import { useState } from 'react'

const LoginForm = ({ onLogin }) => {
  const [password, setPassword] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    onLogin(password)
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      flexDirection: 'column',
      gap: 3,
      bg: 'muted'
    }}>
      <Box 
        as="form" 
        onSubmit={handleSubmit} 
        sx={{ 
          p: 4, 
          bg: 'background', 
          borderRadius: 'small', 
          boxShadow: '0 0 8px rgba(0,0,0,0.125)',
          width: '300px',
          display: 'flex',
          flexDirection: 'column',
          gap: 3
        }}
      >
        <Label htmlFor="password" sx={{ fontSize: 3, fontWeight: 'bold' }}>Password</Label>
        <Input 
          type="password" 
          id="password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          sx={{ p: 2, fontSize: 2 }}
        />
        <Button 
          type="submit" 
          sx={{ 
            p: 2, 
            fontSize: 2, 
            fontWeight: 'bold', 
            bg: '#FFFF00',
            color: 'black',
            '&:hover': {
              bg: '#FFD700'
            }
          }}
        >
          Login
        </Button>
      </Box>
    </Box>
  )
}

export default LoginForm 