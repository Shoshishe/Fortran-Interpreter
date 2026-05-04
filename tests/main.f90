subroutine print_matrix(matrix)
  integer,dimension(2,2)::matrix
  do i=1,2
    do j=1,2
      print *,matrix(i,j)
    end do
  end do
  end subroutine
program main
  integer,dimension(2,2)::m
  call print_matrix(m)
end program