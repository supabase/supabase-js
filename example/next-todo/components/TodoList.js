import { useState, useEffect } from 'react'
import { supabase } from '../lib/api'

let subscription1 = null
let subscription2 = null

export default function Todos({ user }) {
  const [todos, setTodos] = useState([])
  const [newTaskText, setNewTaskText] = useState('')
  const [errorText, setError] = useState('')

  useEffect(() => {
    fetchTodos()

    subscription1 = supabase
      .channel('todos-table-channel')
      .on('realtime', { event: 'UPDATE', schema: 'public', table: 'todos' }, (v) =>
        console.log('UPDATE on todos', v)
      )
      .on('realtime', { event: 'INSERT', schema: 'public', table: 'todos' }, (v) =>
        console.log('INSERT on todos', v)
      )
      .subscribe((change) => console.log('todos changed', change))

    subscription2 = supabase
      .channel('public-schema-channel')
      .on('realtime', { event: 'UPDATE', schema: 'public' }, (v) =>
        console.log('UPDATE on schema', v)
      )
      .on('realtime', { event: 'INSERT', schema: 'public' }, (v) =>
        console.log('INSERT on schema', v)
      )
      .subscribe((change) => console.log('schema changed', change))

    return () => {
      supabase.removeAllChannels()
    }
  }, [])

  const fetchTodos = async () => {
    let { error, data } = await supabase.from('todos').select().order('id')
    if (error) {
      console.log(error.message)
      return
    }
    setTodos(data)
  }
  const addTodo = async (taskText) => {
    try {
      supabase.removeChannel(subscription2)

      let task = taskText.trim()
      if (task.length) {
        let { error, data } = await supabase
          .from('todos')
          .insert({ task, user_id: user.id })
          .single()

        if (error) throw error
        setNewTaskText('')
        setTodos([...todos, data])
      }
    } catch (error) {
      console.log('error', error)
      setError(error.message)
    }
  }

  const deleteTodo = async (id) => {
    try {
      await supabase.from('todos').delete().eq('id', id)
      setTodos(todos.filter((x) => x.id != id))
    } catch (error) {
      console.log('error', error)
    }
  }

  return (
    <div className="w-full">
      <h1 className="mb-12 text-white">Todo List.</h1>
      <div className="flex gap-2 my-2">
        <input
          className="rounded w-full p-2 bg-gray-800 text-white"
          type="text"
          placeholder="make coffee"
          value={newTaskText}
          onChange={(e) => {
            setError('')
            setNewTaskText(e.target.value)
          }}
        />
        <button className="btn-black" onClick={() => addTodo(newTaskText)}>
          Add
        </button>
      </div>
      {!!errorText && <Alert text={errorText} />}
      <div className="bg-white shadow-lg overflow-hidden rounded-md bg-gray-800">
        <ul>
          {todos.map((todo) => (
            <Todo key={todo.id} todo={todo} onDelete={() => deleteTodo(todo.id)} />
          ))}
        </ul>
      </div>
    </div>
  )
}

const Todo = ({ todo, onDelete }) => {
  const [isCompleted, setIsCompleted] = useState(todo.is_complete)

  const toggle = async () => {
    try {
      const { body } = await supabase
        .from('todos')
        .update({ is_complete: !isCompleted })
        .eq('id', todo.id)
        .single()
      setIsCompleted(body.is_complete)
    } catch (error) {
      console.log('error', error)
    }
  }

  return (
    <li
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle()
      }}
      className="w-full block cursor-pointer bg-gray-800 hover:bg-gray-700 focus:outline-none focus:bg-gray-700 transition duration-150 ease-in-out"
    >
      <div className="flex items-center px-4 py-4 sm:px-6">
        <div className="min-w-0 flex-1 flex items-center">
          <div className="text-sm leading-5 font-medium truncate text-white">
            {isCompleted ? <span>👍 &nbsp;&nbsp;&nbsp;</span> : null}
            {todo.task}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onDelete()
          }}
          className="w-4 h-4 ml-2 border-2 border-gray-700 hover:border-gray-500 rounded"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="gray">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </li>
  )
}

const Alert = ({ text }) => (
  <div className="rounded-md bg-red-100 p-4 my-3">
    <div className="text-sm leading-5 text-red-700">{text}</div>
  </div>
)
