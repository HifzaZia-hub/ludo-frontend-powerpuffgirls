let playerCount = 2;

const countButtons = document.querySelectorAll('.count-btn');
const nameInputs = {
  1: document.getElementById('player1'),
  2: document.getElementById('player2'),
  3: document.getElementById('player3'),
  4: document.getElementById('player4'),
};

countButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    playerCount = parseInt(btn.dataset.count, 10);
    updatePlayerCount();
  });
});

function updatePlayerCount() {
  countButtons.forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`.count-btn[data-count="${playerCount}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  for (let i = 1; i <= 4; i++) {
    nameInputs[i].style.display = (i <= playerCount) ? 'block' : 'none';
  }
}

document.getElementById('start-btn').addEventListener('click', () => {
  const players = [];
  for (let i = 1; i <= playerCount; i++) {
    players.push({
      name: nameInputs[i].value.trim() || `Player ${i}`,
      seat: i
    });
  }
  console.log('Game starting with:', { playerCount, players });
  alert(`Game starting with ${playerCount} players! Check console for details.`);
});

updatePlayerCount();
