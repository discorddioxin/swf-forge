package com.gaiaonline.gameFramework.ui
{
   public interface IUserBar
   {
      
      function toggleNewGameButton(param1:Boolean = true) : void;
      
      function removeNewGameListener(param1:Function) : void;
      
      function addNewGameListener(param1:Function) : void;
      
      function updateGold() : void;
   }
}

