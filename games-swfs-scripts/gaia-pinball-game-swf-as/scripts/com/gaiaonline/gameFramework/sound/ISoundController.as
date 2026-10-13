package com.gaiaonline.gameFramework.sound
{
   public interface ISoundController
   {
      
      function stopMusic() : void;
      
      function turnOnMusic() : void;
      
      function muteMusic() : void;
      
      function stopSoundLoop() : void;
      
      function turnOnSound() : void;
      
      function muteSound() : void;
      
      function playMusic(param1:String, ... rest) : void;
      
      function playSound(param1:String, ... rest) : void;
      
      function playSoundLoop(param1:String, ... rest) : void;
   }
}

